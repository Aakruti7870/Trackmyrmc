---
name: RMC Place Order all-fields-mandatory
description: The customer Place Order form gates submit on the full delivery brief; how to satisfy it in jsdom tests.
---

The customer Place Order modal (rmc-app MyOrders) requires the COMPLETE delivery
brief before submit: plant, grade, quantity, deliveryDate, deliveryTime,
contactPerson, contactNumber, siteName, siteAddress, a map pin (lat/lng),
paymentType, and notes. PO Number is required ONLY when paymentType === 'Credit'.

**Why:** the plant needs a fully actionable order and (C) live tracking needs the
site lat/lng, so partial submits are blocked with per-field errors.

**How to apply (tests):** any test that submits an order must fill all of the
above or submit silently no-ops.
- date/time inputs have no placeholder/label association — set them with
  `fireEvent.change(container.querySelector('input[type="date"]')!, ...)` (only the
  modal's date/time inputs exist unless you're on the Deliveries history tab).
- the map pin can't be clicked in jsdom; stub `navigator.geolocation.getCurrentPosition`
  in beforeEach and click the picker's "My location" button to drop the pin.
- reorder carries the whole brief forward EXCEPT deliveryDate/deliveryTime (always
  blank), so a reorder submit test still must re-enter date + time.
