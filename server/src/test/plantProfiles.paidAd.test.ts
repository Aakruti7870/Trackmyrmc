import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { plants, users } from '../db/schema.js';
import { plantCertificates, plantProfiles, plantPromotions } from '../db/plantProfileSchema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';

let app: Express;
let seq = 0;

async function createPlant(latitude = '19.0000000', longitude = '72.0000000') {
  seq += 1;
  const [plant] = await db.insert(plants).values({
    plantCode: `PROFILE-${seq}`,
    name: `Profile Plant ${seq}`,
    latitude,
    longitude,
    plantStatus: 'approved',
    isActive: true,
    locationVerified: true,
    verified: true,
    networkStatus: 'active',
    showOnNetwork: true,
    grades: ['M25'],
    deliveryRadiusKm: 100,
  }).returning();
  return plant;
}

async function createUser(role: 'authority' | 'plant_owner' | 'admin' | 'client', email: string, plantId: number | null = null) {
  const [user] = await db.insert(users).values({
    name: `${role} user`,
    email,
    passwordHash: await hashPassword('secret123'),
    role,
    plantId,
    isActive: true,
  }).returning();
  return user;
}

function tokenFor(user: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ${plantPromotions} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${plantCertificates} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${plantProfiles} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${users} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${plants} RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

test('plant owner can save and submit own profile, but cannot edit another plant', async () => {
  const plant = await createPlant();
  const otherPlant = await createPlant();
  const owner = await createUser('plant_owner', 'profile-owner@test.com', plant.id);
  const token = tokenFor(owner);

  const saved = await request(app).put(`/api/plants/${plant.id}/profile`).set('Authorization', `Bearer ${token}`).send({
    productionCapacityM3PerHour: 53,
    numberOfTransitMixers: 21,
    laboratoryAvailable: true,
    creditPaymentAvailable: true,
    creditDaysMin: 7,
    creditDaysMax: 30,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.profileStatus, 'draft');
  assert.equal(saved.body.productionCapacityM3PerHour, '53.00');
  assert.equal(saved.body.numberOfTransitMixers, 21);

  const submitted = await request(app).post(`/api/plants/${plant.id}/profile/submit`).set('Authorization', `Bearer ${token}`).send({});
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.profileStatus, 'submitted');

  const forbidden = await request(app).put(`/api/plants/${otherPlant.id}/profile`).set('Authorization', `Bearer ${token}`).send({ numberOfTransitMixers: 5 });
  assert.equal(forbidden.status, 403);
});

test('public About Plant response exposes only verified safe fields and optional certificate document stays null', async () => {
  const plant = await createPlant();
  const owner = await createUser('plant_owner', 'safe-owner@test.com', plant.id);
  const authority = await createUser('authority', 'safe-authority@test.com');
  const customer = await createUser('client', 'safe-customer@test.com');

  await request(app).put(`/api/plants/${plant.id}/profile`).set('Authorization', `Bearer ${tokenFor(owner)}`).send({
    productionCapacityM3PerHour: 53,
    maximumDailySupplyCapacityM3: 450,
    numberOfTransitMixers: 21,
    laboratoryAvailable: true,
    paymentTermsNotes: '<b>Credit after approval</b>',
  });
  await request(app).post(`/api/plants/${plant.id}/profile/submit`).set('Authorization', `Bearer ${tokenFor(owner)}`).send({});
  const verified = await request(app).post(`/api/admin/plant-profiles/${plant.id}/verify`).set('Authorization', `Bearer ${tokenFor(authority)}`).send({});
  assert.equal(verified.status, 200);

  const certificate = await request(app).post(`/api/plants/${plant.id}/certificates`).set('Authorization', `Bearer ${tokenFor(owner)}`).send({
    certificateType: 'Other',
    certificateName: 'Manual Quality Certificate',
    certificateStatus: 'available',
    isVisibleToCustomer: true,
  });
  assert.equal(certificate.status, 201);
  assert.equal(certificate.body.documentUrl, null);
  await request(app).post(`/api/admin/plant-certificates/${certificate.body.id}/verify`).set('Authorization', `Bearer ${tokenFor(authority)}`).send({ verificationMethod: 'manual_confirmation' });

  const response = await request(app).get(`/api/plants/${plant.id}/profile`).set('Authorization', `Bearer ${tokenFor(customer)}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.profile.profileStatus, 'verified');
  assert.equal(response.body.profile.numberOfTransitMixers, 21);
  assert.equal(response.body.profile.paymentTermsNotes, 'Credit after approval');
  assert.equal(response.body.profile.createdBy, undefined);
  assert.equal(response.body.profile.updatedBy, undefined);
  assert.equal(response.body.profile.reviewedBy, undefined);
  assert.equal(response.body.profile.rejectionReason, undefined);
  assert.equal(response.body.profile.completionPercentage, undefined);
  assert.equal(response.body.certificates[0].documentUrl, null);
  assert.equal(response.body.certificates[0].ownerNotes, undefined);
});

test('owner edit after verification returns profile to draft and hides it from customers until re-verified', async () => {
  const plant = await createPlant();
  const owner = await createUser('plant_owner', 'reverify-owner@test.com', plant.id);
  const authority = await createUser('authority', 'reverify-authority@test.com');
  const customer = await createUser('client', 'reverify-customer@test.com');

  await request(app).put(`/api/plants/${plant.id}/profile`).set('Authorization', `Bearer ${tokenFor(owner)}`).send({ numberOfTransitMixers: 10 });
  await request(app).post(`/api/plants/${plant.id}/profile/submit`).set('Authorization', `Bearer ${tokenFor(owner)}`).send({});
  await request(app).post(`/api/admin/plant-profiles/${plant.id}/verify`).set('Authorization', `Bearer ${tokenFor(authority)}`).send({});

  const edited = await request(app).put(`/api/plants/${plant.id}/profile`).set('Authorization', `Bearer ${tokenFor(owner)}`).send({ numberOfTransitMixers: 21 });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.profileStatus, 'draft');

  const publicResponse = await request(app).get(`/api/plants/${plant.id}/profile`).set('Authorization', `Bearer ${tokenFor(customer)}`);
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.body.profile, null);
  assert.equal(publicResponse.body.pendingChanges, true);
  assert.match(publicResponse.body.message, /awaiting verification/i);
});

test('Paid Ad plant is first and glowing only within 15 km of its own location', async () => {
  const organic = await createPlant('19.0000000', '72.1100000');
  const paid = await createPlant('19.0000000', '72.2000000');
  const authority = await createUser('authority', 'ad-authority@test.com');
  const customer = await createUser('client', 'ad-customer@test.com');

  await db.insert(plantProfiles).values([
    { plantId: organic.id, profileStatus: 'verified', numberOfTransitMixers: 5 },
    { plantId: paid.id, profileStatus: 'verified', numberOfTransitMixers: 21, productionCapacityM3PerHour: '53' },
  ]);
  await db.insert(plantPromotions).values({
    plantId: paid.id,
    packageType: 'custom',
    promotionRadiusKm: '15',
    priorityRank: 1,
    bannerTitle: '',
    showGlowingEffect: true,
    paymentStatus: 'paid',
    startAt: new Date(Date.now() - 3600000),
    endAt: new Date(Date.now() + 86400000),
    isActive: true,
    createdBy: authority.id,
    approvedBy: authority.id,
  });

  const inside = await request(app).get('/api/plants/nearby?lat=19&lng=72.1&radius=100').set('Authorization', `Bearer ${tokenFor(customer)}`);
  assert.equal(inside.status, 200);
  assert.equal(inside.body.plants[0].id, paid.id);
  assert.equal(inside.body.plants[0].showGlowingEffect, true);
  assert.equal(inside.body.plants[0].capabilities.numberOfTransitMixers, 21);
  assert.equal(JSON.stringify(inside.body).toLowerCase().includes('sponsored'), false);

  const outside = await request(app).get('/api/plants/nearby?lat=19&lng=71.9&radius=100').set('Authorization', `Bearer ${tokenFor(customer)}`);
  assert.equal(outside.status, 200);
  assert.equal(outside.body.plants[0].id, organic.id);
  const paidOutside = outside.body.plants.find((plant: { id: number }) => plant.id === paid.id);
  assert.equal(paidOutside.showGlowingEffect, false);
});

test('only Super Admin can create Paid Ads and the backend fixes radius and glow values', async () => {
  const plant = await createPlant();
  const authority = await createUser('authority', 'create-ad-authority@test.com');
  const customer = await createUser('client', 'create-ad-customer@test.com');
  const payload = {
    plantId: plant.id,
    priorityRank: 1,
    paymentStatus: 'paid',
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    promotionRadiusKm: 99,
    showGlowingEffect: false,
  };

  const denied = await request(app).post('/api/admin/plant-promotions').set('Authorization', `Bearer ${tokenFor(customer)}`).send(payload);
  assert.equal(denied.status, 403);

  const created = await request(app).post('/api/admin/plant-promotions').set('Authorization', `Bearer ${tokenFor(authority)}`).send(payload);
  assert.equal(created.status, 201);
  assert.equal(created.body.promotionRadiusKm, '15.00');
  assert.equal(created.body.showGlowingEffect, true);
});
