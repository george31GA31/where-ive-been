/* Reviewed destination rule sets. See README for scope and refresh policy. */
(function(root){const data={
  "version": 1,
  "checked": "2026-10-02",
  "rules": [
    {
      "id": "cta-gb-ie",
      "passports": [
        "GB"
      ],
      "destinations": [
        "IE"
      ],
      "status": "conditional-exemption",
      "text": "British and Irish citizens can travel under the Common Travel Area. Carry identification accepted by your carrier.",
      "sources": [
        {
          "name": "UK government entry guidance",
          "url": "https://www.gov.uk/foreign-travel-advice/ireland/entry-requirements",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism",
        "business"
      ],
      "title": "Entry under the Common Travel Area",
      "stay": "Common Travel Area citizenship rights apply; no short-visit visa limit is stated here"
    },
    {
      "id": "cta-ie-gb",
      "passports": [
        "IE"
      ],
      "destinations": [
        "GB"
      ],
      "status": "conditional-exemption",
      "text": "Irish citizens can travel under the Common Travel Area. Carry identification accepted by your carrier.",
      "sources": [
        {
          "name": "UK government entry guidance",
          "url": "https://www.gov.uk/foreign-travel-advice/ireland/entry-requirements",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "title": "Entry under the Common Travel Area",
      "stay": "Common Travel Area citizenship rights apply; no short-visit visa limit is stated here"
    },
    {
      "id": "gb-schengen",
      "passports": [
        "GB"
      ],
      "destinations": [
        "AT",
        "BE",
        "BG",
        "HR",
        "CZ",
        "DK",
        "EE",
        "FI",
        "FR",
        "DE",
        "GR",
        "HU",
        "IS",
        "IT",
        "LV",
        "LI",
        "LT",
        "LU",
        "MT",
        "NL",
        "NO",
        "PL",
        "PT",
        "RO",
        "SK",
        "SI",
        "ES",
        "SE",
        "CH"
      ],
      "status": "visa-free",
      "text": "Ordinary British citizen passports: up to 90 days across Schengen in any 180-day period. This does not establish your remaining allowance.",
      "sources": [
        {
          "name": "UK government entry guidance",
          "url": "https://www.gov.uk/foreign-travel-advice/france/entry-requirements",
          "kind": "official",
          "checked": "2026-10-02"
        },
        {
          "name": "European Commission: entry conditions from 1 January 2021",
          "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:52020DC0324",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism",
        "business"
      ],
      "days": 90,
      "stay": "90 days across Schengen in any 180-day period",
      "passport": {
        "validity": "Valid for at least 3 months after planned departure from Schengen; issued within the previous 10 years."
      },
      "other": [
        "Border registration and any electronic authorisation must be checked against the official travel-date guidance."
      ],
      "validFrom": "2021-01-01"
    },
    {
      "id": "br-schengen",
      "passports": [
        "BR"
      ],
      "destinations": [
        "AT",
        "BE",
        "BG",
        "HR",
        "CZ",
        "DK",
        "EE",
        "FI",
        "FR",
        "DE",
        "GR",
        "HU",
        "IS",
        "IT",
        "LV",
        "LI",
        "LT",
        "LU",
        "MT",
        "NL",
        "NO",
        "PL",
        "PT",
        "RO",
        "SK",
        "SI",
        "ES",
        "SE",
        "CH"
      ],
      "status": "visa-free",
      "text": "The EU–Brazil agreement exempts ordinary passports for short tourism and business visits.",
      "sources": [
        {
          "name": "EU–Brazil visa-waiver agreement",
          "url": "https://eur-lex.europa.eu/eli/agree_internation/2012/508/2022-10-01/eng",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism",
        "business"
      ],
      "days": 90,
      "stay": "90 days across Schengen in any 180-day period",
      "passport": {
        "validity": "Valid for at least 3 months after planned departure from Schengen; issued within the previous 10 years."
      }
    },
    {
      "id": "gb-al",
      "passports": [
        "GB"
      ],
      "destinations": [
        "AL"
      ],
      "status": "visa-free",
      "text": "Short tourism visits are visa-free; longer visits require permission.",
      "sources": [
        {
          "name": "UK government entry guidance",
          "url": "https://www.gov.uk/foreign-travel-advice/albania/entry-requirements",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "days": 90,
      "stay": "90 days in any 180-day period"
    },
    {
      "id": "gb-in",
      "passports": [
        "GB"
      ],
      "destinations": [
        "IN"
      ],
      "status": "visa-required",
      "text": "Arrange an appropriate visa or eligible eVisa before travel. OCI/e-OCI exemptions have separate conditions.",
      "sources": [
        {
          "name": "UK government entry guidance",
          "url": "https://www.gov.uk/foreign-travel-advice/india/entry-requirements",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ]
    },
    {
      "id": "gb-eg",
      "passports": [
        "GB"
      ],
      "destinations": [
        "EG"
      ],
      "status": "visa-on-arrival",
      "text": "A visa on arrival or advance visa is normally available to ordinary British citizen passports. Limited Sinai resort exemptions have separate conditions.",
      "sources": [
        {
          "name": "UK government entry guidance",
          "url": "https://www.gov.uk/foreign-travel-advice/egypt/entry-requirements",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "days": 30,
      "stay": "Up to 30 days; check the permission granted"
    },
    {
      "id": "gb-gy",
      "passports": [
        "GB"
      ],
      "destinations": [
        "GY"
      ],
      "status": "visa-free",
      "text": "A visa is not normally required for ordinary British citizen tourists.",
      "sources": [
        {
          "name": "UK government entry guidance",
          "url": "https://www.gov.uk/foreign-travel-advice/guyana/entry-requirements",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "days": 30,
      "stay": "Normally 30 days; extensions require permission",
      "passport": {
        "validity": "At least 6 months after arrival"
      }
    },
    {
      "id": "td-gy",
      "passports": [
        "TD"
      ],
      "destinations": [
        "GY"
      ],
      "status": "visa-required",
      "text": "Chad is not listed in Guyana’s ordinary-passport visa exemptions. Arrange a visa before travel or obtain advance approval for a visa on arrival; this is not an unconditional airport visa.",
      "sources": [
        {
          "name": "Guyana Ministry of Foreign Affairs visa exemptions",
          "url": "https://www.minfor.gov.gy/visa-information",
          "kind": "official",
          "checked": "2026-10-02"
        },
        {
          "name": "Guyana Embassy: advance visa-on-arrival approval",
          "url": "https://www.embassyofguyana.be/services.php?sid=34",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "stay": "Depends on the visa or entry permission granted",
      "other": [
        "Advance visa-on-arrival applications should be submitted 10–14 working days before travel."
      ]
    },
    {
      "id": "tl-ua",
      "passports": [
        "TL"
      ],
      "destinations": [
        "UA"
      ],
      "status": "evisa",
      "text": "Ukraine lists Timor-Leste as requiring a visa, including an eVisa where that service is available. Check application availability, entry routes and wartime restrictions before travel.",
      "sources": [
        {
          "name": "Ukraine Ministry of Foreign Affairs entry regime",
          "url": "https://mfa.gov.ua/en/consular-affairs/entry-and-stay-foreigners-ukraine/entry-regime-ukraine-foreign-citizens",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "days": 30,
      "stay": "Tourist eVisas: up to 30 days, subject to the visa issued"
    },
    {
      "id": "vwp-us",
      "passports": [
        "AD",
        "AU",
        "AT",
        "BE",
        "BN",
        "CL",
        "HR",
        "CZ",
        "DK",
        "EE",
        "FI",
        "FR",
        "DE",
        "GR",
        "HU",
        "IS",
        "IE",
        "IL",
        "IT",
        "JP",
        "LV",
        "LI",
        "LT",
        "LU",
        "MT",
        "MC",
        "NL",
        "NZ",
        "NO",
        "PL",
        "PT",
        "QA",
        "SM",
        "SG",
        "SK",
        "SI",
        "KR",
        "ES",
        "SE",
        "CH",
        "TW",
        "GB"
      ],
      "destinations": [
        "US"
      ],
      "status": "eta",
      "text": "Eligible Visa Waiver Program travellers need ESTA approval before boarding, including transit. Prior travel and dual nationality can require a visa instead.",
      "sources": [
        {
          "name": "US Department of State Visa Waiver Program",
          "url": "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visa-waiver-program.html",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism",
        "business"
      ],
      "days": 90,
      "stay": "Up to 90 days under the Visa Waiver Program",
      "passport": {
        "condition": "An eligible biometric e-passport is required. Verify nationality-specific validity rules."
      },
      "other": [
        "Travel or presence in Cuba since 12 January 2021, or North Korea, Iran, Iraq, Libya, Somalia, Sudan, Syria or Yemen since 1 March 2011 can make ESTA unavailable. Dual-nationality restrictions also apply."
      ]
    },
    {
      "id": "de-jp",
      "passports": [
        "DE",
        "GB",
        "FR",
        "BR",
        "MT"
      ],
      "destinations": [
        "JP"
      ],
      "status": "visa-free",
      "text": "Japan exempts these ordinary passport holders for short visits. Work is not permitted under the tourism exemption.",
      "sources": [
        {
          "name": "Japan Ministry of Foreign Affairs visa exemptions",
          "url": "https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism",
        "business"
      ],
      "days": 90,
      "stay": "Initially up to 90 days; some bilateral extensions require an application"
    },
    {
      "id": "in-jp",
      "passports": [
        "IN"
      ],
      "destinations": [
        "JP"
      ],
      "status": "visa-required",
      "text": "Indian ordinary passport holders need a visa. A tourist eVisa may be available through eligible application channels based on residence; it is not an unconditional nationality exemption.",
      "sources": [
        {
          "name": "Japan Ministry of Foreign Affairs visa exemptions",
          "url": "https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html",
          "kind": "official",
          "checked": "2026-10-02"
        },
        {
          "name": "Japan eVisa eligibility and residence",
          "url": "https://www.mofa.go.jp/j_info/visit/visa/visaonline.html",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "stay": "Depends on the visa issued",
      "other": [
        "The Japan eVisa route depends on country of residence and, in some cases, an accredited travel agency."
      ]
    },
    {
      "id": "np-ar",
      "passports": [
        "NP"
      ],
      "destinations": [
        "AR"
      ],
      "status": "visa-required",
      "text": "Argentina lists Nepal as requiring a tourist visa. A conditional AVE authorisation route is listed; eligibility must be confirmed before applying.",
      "sources": [
        {
          "name": "Argentina immigration visa regime",
          "url": "https://www.migraciones.gov.ar/accesible/indexdnm.php?visas=",
          "kind": "official",
          "checked": "2026-10-02"
        },
        {
          "name": "Argentina AVE conditions",
          "url": "https://www.migraciones.gov.ar/ave/index.htm",
          "kind": "official",
          "checked": "2026-10-02"
        },
        {
          "name": "Argentina government: tourist-visa documents",
          "url": "https://www.argentina.gob.ar/servicio/obtener-visa-de-turista-para-ingresar-la-argentina",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "stay": "Tourist admission: up to 3 months, subject to the visa and permission granted",
      "passport": {
        "validity": "Tourist-visa application: at least 6 months from the date of entry",
        "blankPages": "At least one blank leaf (two sides) for the tourist-visa application"
      },
      "other": [
        "Tourist-visa applications require supporting accommodation, onward travel and financial documentation. Check the consulate’s full application list."
      ]
    },
    {
      "id": "mt-sr",
      "passports": [
        "MT"
      ],
      "destinations": [
        "SR"
      ],
      "status": "entry-permit",
      "text": "Tourist entry is visa-free with an entry-fee voucher. The entry-fee process is distinct from an ETA or a visa.",
      "sources": [
        {
          "name": "Suriname Ministry of Foreign Affairs travel guidance",
          "url": "https://gov.sr/ministeries/ministerie-van-buitenlandse-zaken-internationale-handel-samenwerking/reizen-naar-suriname/",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "days": 90,
      "stay": "Up to 90 days for tourism or family visits",
      "other": [
        "Pay the entry fee through the officially linked VFS portal before travel and retain the voucher. Check current fee and exemptions."
      ]
    },
    {
      "id": "jp-gh",
      "passports": [
        "JP"
      ],
      "destinations": [
        "GH"
      ],
      "status": "evisa",
      "text": "Japan is not listed among Ghana’s ordinary-passport exemptions. Obtain a visa before travel; Ghana’s official eVisa portal is available.",
      "sources": [
        {
          "name": "Ghana Immigration Service visas",
          "url": "https://gis.gov.gh/visas/",
          "kind": "official",
          "checked": "2026-10-02"
        },
        {
          "name": "Ghana official eVisa portal",
          "url": "https://evisa.immigration.gov.gh/",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "stay": "Depends on the visa and permission granted"
    },
    {
      "id": "th-30",
      "passports": [
        "AU",
        "AT",
        "BH",
        "BE",
        "BT",
        "BN",
        "BG",
        "CA",
        "HR",
        "CY",
        "CZ",
        "DK",
        "EE",
        "FJ",
        "FI",
        "FR",
        "GE",
        "DE",
        "GR",
        "HU",
        "IS",
        "IN",
        "ID",
        "IE",
        "IL",
        "IT",
        "JP",
        "JO",
        "KW",
        "KG",
        "LV",
        "LI",
        "LT",
        "LU",
        "MY",
        "MV",
        "MT",
        "NL",
        "NZ",
        "NO",
        "OM",
        "PH",
        "PL",
        "PT",
        "QA",
        "RO",
        "SA",
        "SG",
        "SK",
        "SI",
        "ZA",
        "ES",
        "SE",
        "CH",
        "TW",
        "TR",
        "UA",
        "AE",
        "GB",
        "US"
      ],
      "destinations": [
        "TH"
      ],
      "status": "visa-free",
      "text": "Thailand’s revised ordinary-passport tourism exemption applies from 15 September 2026. Extensions require permission.",
      "sources": [
        {
          "name": "Royal Thai Embassy: exemptions effective 15 September 2026",
          "url": "https://doha.thaiembassy.org/en/publicservice/tourist-visa-exemption-visa-on-arrival?menu=5d7e6a3c15e39c032c006dbb&page=5d7e6a3c15e39c032c006dba",
          "kind": "official",
          "checked": "2026-10-02"
        },
        {
          "name": "Thailand government: digital arrival card",
          "url": "https://thailand.go.th/public/index.php/issue-focus-detail/thailand-digital-arrival-card-tdac-to-start-on-1-may-2025?hl=en",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 14,
      "purposes": [
        "tourism"
      ],
      "days": 30,
      "stay": "Up to 30 days",
      "validFrom": "2026-09-15",
      "other": [
        "Complete the Thailand Digital Arrival Card through the official Immigration Bureau website before arrival."
      ]
    },
    {
      "id": "th-60-previous",
      "passports": [
        "ZA",
        "GB"
      ],
      "destinations": [
        "TH"
      ],
      "status": "visa-free",
      "text": "The previous Thailand tourism exemption allowed up to 60 days. The revised 30-day rule begins 15 September 2026.",
      "sources": [
        {
          "name": "Royal Thai Embassy Pretoria: previous exemption",
          "url": "https://pretoria.thaiembassy.org/en/publicservice/visa-exemption-and-visa-on-arrival",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ],
      "checked": "2026-10-02",
      "refreshDays": 30,
      "purposes": [
        "tourism"
      ],
      "days": 60,
      "stay": "Up to 60 days under the previous exemption",
      "validFrom": "2024-07-15",
      "validTo": "2026-09-14"
    },
    {
      "id": "vn-evisa",
      "passports": [
        "*"
      ],
      "destinations": [
        "VN"
      ],
      "datasetStatuses": [
        "evisa",
        "visa-required"
      ],
      "purposes": [
        "tourism"
      ],
      "status": "evisa",
      "text": "Vietnam accepts tourist eVisa applications from all nationalities. Apply through the official portal and use an eligible border checkpoint.",
      "days": 90,
      "stay": "eVisas can be issued for up to 90 days, for single or multiple entries; follow the validity on the visa issued.",
      "checked": "2026-10-02",
      "refreshDays": 30,
      "sources": [
        {
          "name": "Vietnam Immigration Department eVisa portal",
          "url": "https://evisa.gov.vn/",
          "kind": "official",
          "checked": "2026-10-02"
        },
        {
          "name": "Vietnam National Authority of Tourism: worldwide eVisa eligibility",
          "url": "https://vietnam.travel/things-to-do/vietnam-issues-e-visas-citizens-all-countriesterritories",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ]
    }
  ],
  "health": {
    "GY": {
      "checked": "2026-10-02",
      "refreshDays": 30,
      "vaccine": "Yellow fever",
      "minAge": 1,
      "arrivalRisk": true,
      "transitHours": 4,
      "text": "Certificate required for travellers aged 1 year or older arriving from a yellow-fever risk country, including transit there longer than 4 hours.",
      "recommendations": [
        "Hepatitis A vaccination is commonly recommended for unvaccinated travellers; discuss suitability with a travel-health professional."
      ],
      "sources": [
        {
          "name": "NaTHNaC: Guyana health entry requirements",
          "url": "https://travelhealthpro.org.uk/countries/guyana",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ]
    },
    "SR": {
      "checked": "2026-10-02",
      "refreshDays": 30,
      "vaccine": "Yellow fever",
      "minAge": 1,
      "arrivalRisk": true,
      "transitHours": 12,
      "text": "Certificate required for travellers aged 1 year or older arriving from a yellow-fever risk country, including transit there longer than 12 hours.",
      "sources": [
        {
          "name": "NaTHNaC: Suriname health entry requirements",
          "url": "https://travelhealthpro.org.uk/countries/suriname",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ]
    },
    "GH": {
      "checked": "2026-10-02",
      "refreshDays": 30,
      "vaccine": "Yellow fever",
      "minAge": 0.75,
      "exclusiveAge": true,
      "universal": true,
      "text": "Certificate required for all travellers over 9 months of age, regardless of departure country.",
      "sources": [
        {
          "name": "NaTHNaC: Ghana health entry requirements",
          "url": "https://travelhealthpro.org.uk/countries/ghana",
          "kind": "official",
          "checked": "2026-10-02"
        }
      ]
    }
  },
  "yellowFeverRisk": [
    "AO",
    "BJ",
    "BF",
    "BI",
    "CM",
    "CF",
    "TD",
    "CG",
    "CD",
    "GQ",
    "ET",
    "GA",
    "GM",
    "GH",
    "GN",
    "GW",
    "CI",
    "KE",
    "LR",
    "ML",
    "MR",
    "NE",
    "NG",
    "SN",
    "SL",
    "SS",
    "SD",
    "TG",
    "UG",
    "AR",
    "BO",
    "BR",
    "CO",
    "EC",
    "GF",
    "GY",
    "PA",
    "PY",
    "PE",
    "SR",
    "TT",
    "VE"
  ],
  "riskSource": {
    "name": "NaTHNaC / WHO yellow-fever risk countries",
    "url": "https://nathnacyfzone.org.uk/factsheet/65/countries-with-risk-of-yellow-fever-transmission",
    "kind": "official",
    "checked": "2026-10-02"
  }
};if(typeof module!=="undefined"&&module.exports)module.exports=data;else root.HVEntryGuidance=data;})(typeof window!=="undefined"?window:globalThis);
