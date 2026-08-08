export const ROLE_AI_PROMPTS:Record<string,string[]>={
  client:['My active orders','Latest delivery status','My outstanding balance','Explain my challan','How much concrete do I need?'],
  customer:['My active orders','Latest delivery status','My outstanding balance','Explain my challan','How much concrete do I need?'],
  driver:['My trips today','My assigned vehicle','Open my next destination','How to mark a delivery done','Show pending expense claims'],
  dispatcher:['Active orders today','Available transit mixers','Which dispatch is late?','Show route deviations','How to generate a challan'],
  operator:['Production queue today','Which batch needs attention?','Show material variance','M30 mix-design summary','Missing batch entries'],
  supervisor:['Site arrivals today','Delayed deliveries','Missing QC entries','Driver exceptions','Today production vs dispatch'],
  staff:['My assigned work today','Pending orders','Open alerts','Find a challan','Create support ticket'],
  admin:["Today's dispatch summary",'Pending orders','Plant monthly volume','Stock alerts','Diesel anomalies'],
  plant_owner:['Executive summary today','Revenue and dispatch today','Stock runway','Fleet anomalies','Pending payments'],
  owner:['Executive summary today','Revenue and dispatch today','Stock runway','Fleet anomalies','Pending payments'],
  authority:['Platform summary today','Which plants are underperforming?','Top customers by volume','Fleet or fuel anomalies?','Forecast tomorrow demand'],
  super_admin:['Platform summary today','Which plants are underperforming?','Top customers by volume','Fleet or fuel anomalies?','Forecast tomorrow demand'],
  partner:['My plant profile status','Orders routed to my plant','Promotion performance','Verification issues','Contact support'],
};
export const promptsForRole=(role?:string)=>ROLE_AI_PROMPTS[(role||'').toLowerCase()] ?? ['Today summary','Open alerts','My pending work','Help with TrackMyRMC','Contact support'];

export const ROLE_AI_GUARDRAILS:Record<string,string>={
  client:'Only use the signed-in customer\'s orders, challans, payments and public RMC information.',
  customer:'Only use the signed-in customer\'s orders, challans, payments and public RMC information.',
  driver:'Only use the signed-in driver\'s trips, assigned vehicle, expenses, attendance and safety data.',
  dispatcher:'Only use dispatch/order/fleet information for plants the dispatcher is authorized to access.',
  operator:'Only use batching, production, mix-design and stock data for the operator\'s assigned plant.',
  supervisor:'Only use production, delivery, QC and workforce information for the supervisor\'s assigned plant.',
  staff:'Only use routes and records authorized by the current role-permission matrix.',
  admin:'Only use records for the admin\'s assigned organization/plant unless authority access is explicit.',
  plant_owner:'Only use records belonging to plants owned by the signed-in owner.',
  authority:'Authority scope may aggregate platform data, but never expose secrets, credentials or another user\'s authentication data.',
  super_admin:'Super-admin scope may aggregate platform data, but never expose secrets, credentials or raw authentication tokens.',
};
