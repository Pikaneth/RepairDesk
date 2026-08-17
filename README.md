# RepairDesk

RepairDesk is a lightweight, responsive dashboard for keeping device repairs organised. It tracks repair status, parts, labour, dates and costs in one focused interface.

![RepairDesk](https://img.shields.io/badge/RepairDesk-v0.1.1-d9ff63?style=flat-square&labelColor=15231f)
![HTML](https://img.shields.io/badge/HTML5-Project-e34f26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-Responsive-1572b6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-f7df1e?style=flat-square&logo=javascript&logoColor=111)

## Features

- Repair dashboard with live totals and status counts
- Create, edit and delete repair records
- Track multiple parts and individual costs
- Automatic repair and workshop cost calculations
- Waiting, in-progress and completed statuses
- Search, status filters and cost/date sorting
- Light and dark colour themes
- First-run language and currency setup
- Complete interface translations for 20 languages
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
├── LICENSE
└── README.md
```

## Data storage

Repair records, language, currency and theme preferences are stored in the browser using `localStorage`. Data is specific to the current browser and device. Clearing browser site data also removes saved repairs.

Changing the display currency keeps existing numeric values unchanged; RepairDesk does not perform exchange-rate conversion.

## Languages

RepairDesk supports English, Russian, Ukrainian, German, Japanese, French, Italian, Spanish, Portuguese, Simplified Chinese, Hindi, Arabic, Bengali, Turkish, Korean, Indonesian, Polish, Dutch, Vietnamese and Thai. Arabic automatically switches the interface to right-to-left layout.

## Roadmap

- Repair timeline and activity history
- Photo attachments
- JSON import and export
- Tags and custom statuses
- Cloud synchronisation
- Multi-device accounts

## Author

**Pikaneth (Sviatoslav)**

## License

Released under the [MIT License](LICENSE).
