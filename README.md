# RepairDesk

RepairDesk is a responsive workshop dashboard for keeping repairs, parts, orders, customers and documents organised in one focused interface.

![RepairDesk](https://img.shields.io/badge/RepairDesk-v0.1.2-d9ff63?style=flat-square&labelColor=15231f)
![HTML](https://img.shields.io/badge/HTML5-Project-e34f26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-Responsive-1572b6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-f7df1e?style=flat-square&logo=javascript&logoColor=111)

## Features

- Repair dashboard with live totals and status counts
- Create, edit and delete repair records
- Track multiple parts and individual costs
- Complete event timeline for every repair
- Separate repair history workspace with searchable records and notes
- Local parts discovery for 20 countries
- Optional Google Programmable Search integration for live store results and product images
- Price recognition, editable offer prices and a comparison chart
- Ordered and received part statuses recorded in repair history
- Customer details for completed work
- Workshop settings for business and tax information
- Numbered receipts and invoices with print-ready A4 layout
- Browser print workflow for physical printing or saving as PDF
- Automatic repair and workshop cost calculations
- Waiting, in-progress and completed statuses
- Search, status filters and cost/date sorting
- Light and dark colour themes
- First-run language, country and currency setup
- 20-language interface with right-to-left Arabic layout
- ISO 4217 currency selection with locale-aware dates and amounts
- Responsive layout for desktop, tablet and mobile
- Local browser storage with no account required
- Keyboard-friendly controls and accessible labels

## Getting started

No build step or dependencies are required.

1. Download or clone the repository.
2. Open `index.html` in a modern browser.

For local development, start any static file server in the project directory. For example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Project structure

```text
RepairDesk/
├── assets/
│   └── favicon.svg
├── index.html
├── styles.css
├── app.js
├── catalog.js
├── i18n.js
├── i18n-v012.js
├── tests/
│   └── smoke.mjs
├── LICENSE
└── README.md
```

## Data storage

Repair records, history, orders, workshop details, documents and preferences are stored in the browser using `localStorage`. Data is specific to the current browser and device. Clearing browser site data also removes saved repairs.

Changing the display currency keeps existing numeric values unchanged; RepairDesk does not perform exchange-rate conversion.

Existing data from v0.1 and v0.1.1 is upgraded automatically when v0.1.2 opens.

## Parts search

Every selected country has direct search links for established local marketplaces. These links work without an account or configuration.

To show live offers inside RepairDesk:

1. Open **Settings → Parts search**.
2. Create a [Google Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/create).
3. Copy the recommended store domains from RepairDesk into the engine's **Sites to search** list.
4. Paste the engine's `cx` identifier into RepairDesk and test the connection.

Live results can contain product thumbnails and structured prices supplied by each store. RepairDesk only places recognised prices in the chart, keeps currencies separate and lets the technician confirm the final price before recording an order.

Checkout and payment stay on the marketplace. After completing the purchase, mark the selected offer as ordered; the part and repair then move into the waiting workflow. Mark the part received when it arrives.

## Receipts and invoices

Add the workshop name, address, contact details, tax rate and payment details in **Settings**. Completed repairs provide separate **Receipt** and **Invoice** buttons. Each document receives a stable number and is added to the repair timeline.

Use **Print / Save PDF** in the document preview. The browser print dialog can send the A4 document to a printer or save it as a PDF file.

## Validation

Run the dependency-free smoke checks with:

```bash
node tests/smoke.mjs
node tests/runtime-smoke.mjs
```

## Languages

RepairDesk supports English, Russian, Ukrainian, German, Japanese, French, Italian, Spanish, Portuguese, Simplified Chinese, Hindi, Arabic, Bengali, Turkish, Korean, Indonesian, Polish, Dutch, Vietnamese and Thai. Arabic automatically switches the interface to right-to-left layout.

## Roadmap

- Photo attachments
- JSON import and export
- Tags and custom statuses
- Cloud synchronisation
- Multi-device accounts

## Author

**Pikaneth (Sviatoslav)**

## License

Released under the [MIT License](LICENSE).
