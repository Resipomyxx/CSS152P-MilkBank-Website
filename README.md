# Hardcoded Features and Manual Change Notes

This project is a static front-end build. The items below are currently hardcoded in HTML, CSS, or JavaScript and will need manual editing if the content, flow, or data changes later.

## Shared UI
- The header navigation links are hardcoded on each page.
- The Login and Register buttons in the header are hardcoded links to `register.html`.
- Footer contact details, support text, and copyright text are hardcoded.
- The site branding text, page titles, and subtitle labels are hardcoded.

## Home Page
- The hero text, public service copy, and highlight metrics are hardcoded.
- The home-page cards and operational summary figures are hardcoded.
- The public information cards at the bottom are hardcoded.

## Donor Registration
- The donor step rail labels and step order are hardcoded.
- Personal information, medical history, program selection, eligibility review, and account setup field labels are hardcoded.
- The preliminary eligibility checklist text is hardcoded.
- The donor action buttons are hardcoded and do not submit to a backend.

## Consent Form
- The consent instructions and legal copy are hardcoded.
- The checkbox statements for donation guidelines and privacy consent are hardcoded.
- The signature prompt, date text, and compliance note are hardcoded.
- The Save Draft and Submit Consent buttons are front-end only.

## Staff Dashboard
- The greeting name, dashboard stats, and banner message are hardcoded.
- Recent batch entries, milk request entries, and dispensing rows are hardcoded.
- Inventory values by program are hardcoded in the HTML.
- The progress bars are calculated from the hardcoded milliliter values in the page.

## Donation History
- The summary totals, timeline entries, and status labels are hardcoded.
- Donation batch IDs and event descriptions are hardcoded.

## Inventory Page
- The inventory table rows, program names, batch IDs, quantities, and status values are hardcoded.

## Products Page
- Product cards, descriptions, prices, badges, and ratings are hardcoded.
- Filter labels and category counts are hardcoded.

## Register Page
- The onboarding copy, role options, and field labels are hardcoded.
- The form is presentational only and does not connect to authentication.

## JavaScript Behavior
- Mobile navigation open/close behavior is handled in `script.js`.
- Reveal-on-scroll behavior is also handled in `script.js`.
- The inventory program bars are filled from the hardcoded values in `staff.html`.

## Notes
- Backend now WIP
- If you want this site to be data-driven later, the first step will be replacing repeated content blocks with backend-fed templates or API data.
