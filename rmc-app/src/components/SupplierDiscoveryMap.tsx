import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Compass,
  List,
  Map as MapIcon,
  Phone,
  MessageCircle,
  Loader2,
  RefreshCw,
  MapPin,
  ShieldAlert,
  Navigation,
  HandHeart,
  Check,
  Search,
  LocateFixed,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import LocationPicker, { type LatLng } from "@/components/LocationPicker";

// A live, not-yet-onboarded RMC-adjacent supplier discovered from Google Places.
interface DiscoveredSupplier {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  contactNumber: string | null;
  openNow: boolean | null;
  categories: string[];
  distanceKm: number;
}

// Must mirror the server's SUPPLIER_CATEGORIES keys. Colour/glyph are presentation-only.
const CATEGORIES = [
  { key: "ready_mix", label: "Ready-mix plant", color: "#178a6e", svg: '<path d="M2 20h20V9l-6 4V9l-6 4V4H4a2 2 0 0 0-2 2Z"/><path d="M6 17h.01M10 17h.01M14 17h.01M18 17h.01"/>' },
  {
    key: "concrete_supplier",
    label: "Concrete supplier",
    color: "#2563eb",
    svg: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  },
  {
    key: "concrete_contractor",
    label: "Concrete contractor",
    color: "#f59e0b",
    svg: '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M2 18h20"/><path d="M10 7a2 2 0 0 1 4 0v1"/>',
  },
  {
    key: "cement_supplier",
    label: "Cement supplier",
    color: "#64748b",
    svg: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>',
  },
  { key: "fly_ash", label: "Fly ash supplier", color: "#a855f7", svg: '<path d="M7 19H4.8a2 2 0 0 1-1.7-3l2.2-3.7"/><path d="m17 5 2.2 3.7a2 2 0 0 1-1.7 3H13"/><path d="M12 3 9.5 7h5Z"/>' },
  { key: "ggbs", label: "GGBS supplier", color: "#b45309", svg: '<path d="M14.5 3.5a17 17 0 0 1 6 6"/><path d="M3 21l9-9"/><path d="M9 6a17 17 0 0 0-6 3 17 17 0 0 0 3-6"/>' },
] as const;

const CAT_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
const ALL_KEYS = CATEGORIES.map((c) => c.key);

const RADIUS_OPTIONS = [10, 25, 40, 80, 150, 250] as const;
const DEFAULT_RADIUS_KM = 40;

// The public app link sent to suppliers in the invitation message.
const APP_LINK = "https://trackmyrmc.com";

const SAVED_KEY = "rmc_supplier_discovery";

interface SavedLocation {
  coords: LatLng;
  radius: number;
}

function readSaved(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as {
      lat?: unknown;
      lng?: unknown;
      radius?: unknown;
    };
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const r = Number(p.radius);
    const radius = (RADIUS_OPTIONS as readonly number[]).includes(r)
      ? r
      : DEFAULT_RADIUS_KM;
    return { coords: { lat, lng }, radius };
  } catch {
    return null;
  }
}

function saveLocation(coords: LatLng, radius: number) {
  try {
    localStorage.setItem(
      SAVED_KEY,
      JSON.stringify({ lat: coords.lat, lng: coords.lng, radius }),
    );
  } catch {
    // best-effort
  }
}

// Normalise a national phone string to a wa.me-friendly international number.
// Indian numbers come as e.g. "098765 43210" / "+91 98765 43210" / "9876543210".
function toWhatsAppNumber(raw: string | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith("0"))
    digits = `91${digits.slice(1)}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

function inviteMessage(name: string): string {
  return (
    `Hello ${name || "there"}, this is the TrackMyRMC team. ` +
    `We'd like to invite you to join our ready-mix concrete marketplace and reach more customers. ` +
    `You can join / download the app here: ${APP_LINK}`
  );
}

function dot(color: string, glyph: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid rgba(0,0,0,.35);box-shadow:0 3px 8px rgba(0,0,0,.4);display:grid;place-items:center;"><span style="transform:rotate(45deg);font-size:14px;line-height:1">${glyph}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26],
  });
}
// Wrap a category's inner SVG paths as a white line-icon for the coloured pin.
const svgMarker = (inner: string) =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const meIcon = dot("#38bdf8", svgMarker('<circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 10.5 10.5 8.5 15.5 13.5 13.5"/>'));

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 12));
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
  }, [points, map]);
  return null;
}

export default function SupplierDiscoveryMap() {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(
    () => readSaved()?.radius ?? DEFAULT_RADIUS_KM,
  );
  const [suppliers, setSuppliers] = useState<DiscoveredSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const [activeCats, setActiveCats] = useState<Set<string>>(
    () => new Set(ALL_KEYS),
  );
  // Per-supplier "add to onboarding" state, keyed by placeId.
  const [inviteState, setInviteState] = useState<
    Record<string, "sending" | "done" | "error">
  >({});
  const [inviteMsg, setInviteMsg] = useState<Record<string, string>>({});
  const radiusRef = useRef(radiusKm);

  // Fetch ALL categories for the location once (the server caches it); category
  // chips then filter the result client-side, so toggling categories never
  // re-bills the upstream. setState lives in .then/.catch/.finally so this is
  // safe to call from an effect.
  const load = useCallback((c: LatLng, radius: number) => {
    setLoading(true);
    setError("");
    return api
      .get<DiscoveredSupplier[]>(
        `/plants/discover-suppliers?lat=${c.lat}&lng=${c.lng}&radius=${radius}`,
      )
      .then((data) => {
        setSuppliers(data);
      })
      .catch((e: unknown) => {
        setSuppliers([]);
        const status = e instanceof ApiError ? e.status : 0;
        setError(
          status === 503
            ? "Live supplier discovery isn’t configured on this server yet."
            : "We couldn’t search the live supplier directory just now. Please try again.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // Promise-chain so the mount effect never sets state synchronously.
  const locateMe = useCallback(() => {
    return new Promise<LatLng>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("no-geolocation"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        reject,
        { enableHighAccuracy: true, timeout: 12000 },
      );
    })
      .then((c) => {
        setCoords(c);
        saveLocation(c, radiusRef.current);
        return load(c, radiusRef.current);
      })
      .catch(() => {
        /* user can pick a location manually */
      });
  }, [load]);

  const bootstrap = useCallback(() => {
    const saved = readSaved();
    if (!saved) return Promise.resolve();
    return Promise.resolve().then(() => {
      setCoords(saved.coords);
      return load(saved.coords, saved.radius);
    });
  }, [load]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  function handleLocationChange(p: LatLng) {
    setCoords(p);
    saveLocation(p, radiusRef.current);
    load(p, radiusRef.current);
  }

  function changeRadius(r: number) {
    setRadiusKm(r);
    radiusRef.current = r;
    if (coords) {
      saveLocation(coords, r);
      load(coords, r);
    }
  }

  function toggleCat(key: string) {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addToOnboarding(s: DiscoveredSupplier) {
    if (
      inviteState[s.placeId] === "sending" ||
      inviteState[s.placeId] === "done"
    )
      return;
    setInviteState((m) => ({ ...m, [s.placeId]: "sending" }));
    setInviteMsg((m) => ({ ...m, [s.placeId]: "" }));
    api
      .post("/plants/invite", {
        placeId: s.placeId,
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        contactNumber: s.contactNumber,
      })
      .then(() => setInviteState((m) => ({ ...m, [s.placeId]: "done" })))
      .catch((e: Error) => {
        setInviteState((m) => ({ ...m, [s.placeId]: "error" }));
        setInviteMsg((m) => ({
          ...m,
          [s.placeId]: e.message || "Could not add to onboarding.",
        }));
      });
  }

  function inviteOnWhatsApp(s: DiscoveredSupplier) {
    const wa = toWhatsAppNumber(s.contactNumber);
    const text = encodeURIComponent(inviteMessage(s.name));
    const url = wa
      ? `https://wa.me/${wa}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    return suppliers
      .filter((s) => s.categories.some((k) => activeCats.has(k)))
      .filter(
        (s) =>
          !q ||
          (s.name ?? "").toLowerCase().includes(q) ||
          (s.address ?? "").toLowerCase().includes(q),
      );
  }, [suppliers, activeCats, q]);

  const points: [number, number][] = useMemo(
    () => [
      ...(coords ? [[coords.lat, coords.lng] as [number, number]] : []),
      ...shown.map((s) => [s.latitude, s.longitude] as [number, number]),
    ],
    [coords, shown],
  );

  return (
    <div>
      {/* Header — icon square + title + subtitle treatment. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            background: "color-mix(in srgb, var(--gold) 14%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
            color: "var(--gold)",
          }}
        >
          <Compass size={20} />
        </div>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: "var(--text)",
            }}
          >
            Discover Suppliers
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Find real RMC-adjacent suppliers from live Google Maps data and
            invite them to join — results are unverified leads, not yet
            onboarded partners.
          </p>
        </div>
      </div>

      <div style={{ ...softCard, marginBottom: 14 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "var(--text)",
            marginBottom: 10,
          }}
        >
          Search area
        </div>
        <LocationPicker value={coords} onChange={handleLocationChange} />
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--muted)",
            }}
          >
            <Navigation size={14} style={{ color: "var(--gold)" }} />
            <select
              value={radiusKm}
              onChange={(e) => changeRadius(Number(e.target.value))}
              style={radiusSelect}
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  Within {r} km
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => locateMe()} style={ghostBtn}>
            <LocateFixed size={15} /> My location
          </button>
          {coords && (
            <button
              onClick={() => load(coords, radiusKm)}
              style={ghostBtn}
              title="Refresh"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          )}
        </div>
      </div>

      {/* Category filter chips (client-side filter over a single fetch). */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "var(--text)",
          marginBottom: 8,
        }}
      >
        Filter by category
      </div>
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}
      >
        {CATEGORIES.map((c) => {
          const on = activeCats.has(c.key);
          const count = suppliers.filter((s) =>
            s.categories.includes(c.key),
          ).length;
          return (
            <button
              key={c.key}
              onClick={() => toggleCat(c.key)}
              style={chip(on, c.color)}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, display: 'inline-block', flexShrink: 0 }} /> {c.label}
              {count > 0 && <span style={chipCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      {!coords && !loading && (
        <div
          style={{
            ...softCard,
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 13.5,
          }}
        >
          <MapPin size={26} style={{ color: "var(--muted)" }} />
          <div style={{ marginTop: 8, fontWeight: 700, color: "var(--text)" }}>
            Pick a location to start
          </div>
          <div style={{ marginTop: 4 }}>
            Search an address, drop a pin, or use “My location” above.
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            ...softCard,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            borderColor: "color-mix(in srgb, #f59e0b 40%, transparent)",
            background: "color-mix(in srgb, #f59e0b 8%, transparent)",
            fontSize: 13.5,
            marginBottom: 12,
          }}
        >
          <ShieldAlert
            size={18}
            style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }}
          />
          <span style={{ color: "var(--text)" }}>{error}</span>
        </div>
      )}

      {coords && (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted)",
                }}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name or area…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px 10px 38px",
                  borderRadius: 12,
                  background: "var(--chip-bg)",
                  border: "1px solid var(--line)",
                  color: "var(--text)",
                  fontSize: 14,
                  fontWeight: 600,
                  outline: "none",
                }}
              />
            </div>
            <button
              onClick={() => setView("list")}
              style={toggleBtn(view === "list")}
            >
              <List size={15} /> List
            </button>
            <button
              onClick={() => setView("map")}
              style={toggleBtn(view === "map")}
            >
              <MapIcon size={15} /> Map
            </button>
          </div>

          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                color: "var(--muted)",
                fontSize: 13.5,
                fontWeight: 600,
                padding: "10px 2px",
              }}
            >
              <Loader2
                size={16}
                className="np-spin"
                style={{ color: "var(--gold)" }}
              />{" "}
              Searching live supplier directory…
            </div>
          )}

          {!loading && shown.length === 0 && !error && (
            <div
              style={{
                ...softCard,
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 13.5,
              }}
            >
              No suppliers match the current filters within {radiusKm} km. Widen
              the radius or enable more categories.
            </div>
          )}

          {!loading && shown.length > 0 && view === "list" && (
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              }}
            >
              {shown.map((s) => (
                <SupplierCard
                  key={s.placeId}
                  s={s}
                  invite={inviteState[s.placeId]}
                  inviteError={inviteMsg[s.placeId]}
                  onWhatsApp={() => inviteOnWhatsApp(s)}
                  onOnboard={() => addToOnboarding(s)}
                />
              ))}
            </div>
          )}

          {!loading && view === "map" && coords && (
            <div
              style={{
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid var(--line)",
              }}
            >
              <MapContainer
                center={[coords.lat, coords.lng]}
                zoom={11}
                style={{ height: "min(68vh, 560px)", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitAll points={points} />
                <Marker position={[coords.lat, coords.lng]} icon={meIcon}>
                  <Popup>Search centre</Popup>
                </Marker>
                {shown.map((s) => {
                  const cat = CAT_BY_KEY[s.categories[0]] ?? CATEGORIES[0];
                  return (
                    <Marker
                      key={s.placeId}
                      position={[s.latitude, s.longitude]}
                      icon={dot(cat.color, svgMarker(cat.svg))}
                    >
                      <Popup>
                        <div style={{ minWidth: 200 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              marginBottom: 2,
                            }}
                          >
                            {s.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#555",
                              marginBottom: 6,
                            }}
                          >
                            {s.distanceKm} km
                            {s.address ? ` · ${s.address}` : ""}
                          </div>
                          {s.contactNumber && (
                            <div style={{ fontSize: 12, marginBottom: 6 }}>
                              <a
                                href={`tel:${s.contactNumber}`}
                                style={{
                                  color: "#0a66c2",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                }}
                              >
                                {s.contactNumber}
                              </a>
                            </div>
                          )}
                          <button
                            onClick={() => inviteOnWhatsApp(s)}
                            style={{
                              background: "#22c55e",
                              color: "#08251a",
                              border: "none",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Invite on WhatsApp
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SupplierCard({
  s,
  invite,
  inviteError,
  onWhatsApp,
  onOnboard,
}: {
  s: DiscoveredSupplier;
  invite?: "sending" | "done" | "error";
  inviteError?: string;
  onWhatsApp: () => void;
  onOnboard: () => void;
}) {
  const wa = toWhatsAppNumber(s.contactNumber);
  return (
    <div style={{ ...softCard }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text)" }}>
          {s.name}
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--muted)",
            whiteSpace: "nowrap",
          }}
        >
          {s.distanceKm} km
        </span>
      </div>
      <div
        style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "7px 0" }}
      >
        {s.categories.map((k) => {
          const c = CAT_BY_KEY[k];
          if (!c) return null;
          return (
            <span
              key={k}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                color: c.color,
                background: `color-mix(in srgb, ${c.color} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${c.color} 36%, transparent)`,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, display: 'inline-block', flexShrink: 0 }} /> {c.label}
            </span>
          );
        })}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", minHeight: 18 }}>
        {s.address || "Address not listed"}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text)",
          marginTop: 4,
          fontWeight: 600,
        }}
      >
        {s.contactNumber ? (
          <a
            href={`tel:${s.contactNumber}`}
            style={{
              color: "var(--gold)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Phone size={13} /> {s.contactNumber}
          </a>
        ) : (
          <span style={{ color: "var(--muted)" }}>No phone listed</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          onClick={onWhatsApp}
          style={waBtn}
          title={
            wa
              ? "Open a pre-filled WhatsApp invite"
              : "No number — opens WhatsApp with the invite text to forward"
          }
        >
          <MessageCircle size={15} /> Invite on WhatsApp
        </button>
        {invite === "done" ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--green)",
            }}
          >
            <Check size={15} /> Added to onboarding
          </span>
        ) : (
          <button
            onClick={onOnboard}
            disabled={invite === "sending"}
            style={ghostBtn}
          >
            {invite === "sending" ? (
              <Loader2 size={15} className="np-spin" />
            ) : (
              <HandHeart size={15} />
            )}{" "}
            Add to onboarding
          </button>
        )}
      </div>
      {invite === "error" && inviteError && (
        <div style={{ fontSize: 12, color: "var(--red)", marginTop: 6 }}>
          {inviteError}
        </div>
      )}
    </div>
  );
}

const softCard: React.CSSProperties = {
  background: "var(--glass-1)",
  border: "1px solid var(--glass-border)",
  borderRadius: 16,
  padding: 18,
};
const radiusSelect: React.CSSProperties = {
  background: "var(--chip-bg)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 13,
  fontWeight: 700,
  outline: "none",
  cursor: "pointer",
};
function toggleBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 10,
    border: `1px solid ${active ? "var(--gold)" : "var(--line)"}`,
    background: active
      ? "color-mix(in srgb, var(--gold) 16%, transparent)"
      : "var(--chip-bg)",
    color: active ? "var(--gold)" : "var(--text)",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  };
}
const ghostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--chip-bg)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
const waBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 10,
  border: "none",
  background: "#22c55e",
  color: "#08251a",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};
function chip(active: boolean, color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 11px",
    borderRadius: 999,
    border: `1px solid ${active ? color : "var(--line)"}`,
    background: active
      ? `color-mix(in srgb, ${color} 16%, transparent)`
      : "var(--chip-bg)",
    color: active ? color : "var(--muted)",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  };
}
const chipCount: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: "0 6px",
  borderRadius: 999,
  background: "var(--glass-2)",
  color: "inherit",
};
