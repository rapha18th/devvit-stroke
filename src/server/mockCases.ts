export type MockCase = {
  case_id: string;
  brief: string;                 // educate + why investigate (no spoilers)
  images: string[];              // served from webview under /hs/...
  signature_crops: string[];
  metadata: Array<{
    title: string; year: string; medium: string;
    ink_or_pigment?: string; catalog_ref?: string;
    ownership_chain?: string[]; notes?: string;
  }>;
  ledger_summary: string;
  timer_seconds: number;
  initial_ip: number;
  tool_costs: { signature: number; metadata: number; financial: number };
  credits: { source: string; attributions: string[] };
  solution: {
    answer_index: 0 | 1 | 2;
    flags_signature: string[]; flags_metadata: string[];
    flags_financial: string[]; explanation: string;
  };
};

export const caseIdToday = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`;
};

// 5 cases (keep the ones we drafted; you can tweak text/credits).
export const MOCK_CASES: MockCase[] = [
  /* === 001 Vermeer (A authentic) === */ {
    case_id: "001",
    brief:
      "A kitchen maid pours milk beside bread and Delft tiles. The scene’s granular light and quiet gravity are touchstones of Dutch painting. A rediscovered version is claimed; curators request an independent review.",
    images: ["/hs/001/a.jpg","/hs/001/b.jpg","/hs/001/c.jpg"],
    signature_crops: ["/hs/001/a_crop.jpg","/hs/001/b_crop.jpg","/hs/001/c_crop.jpg"],
    metadata: [
      { title:"The Milkmaid", year:"c. 1657–1658", medium:"Oil on canvas",
        ink_or_pigment:"Lead white, natural ultramarine, earth pigments",
        catalog_ref:"Catalogue raisonné, Vermeer no. 10",
        ownership_chain:["17th-c. Dutch private collection","19th-c. Amsterdam collection","Museum holding (20th-c.–)"] },
      { title:"Kitchen Maid (after Vermeer)", year:"late 19th c.", medium:"Oil on canvas",
        catalog_ref:"Paris copyist sale, 1891",
        ownership_chain:["Paris private collection","Dealer stock (1902)","Midwest estate (1958)"] },
      { title:"Dairymaid, attributed", year:"c. 1650s/after", medium:"Oil on canvas",
        catalog_ref:"Registry addendum 1961",
        ownership_chain:["German private collection (1905)","Sale 1931","Private collection (UK)"] },
    ],
    ledger_summary:"A documented Golden Age painting passes through Dutch hands into a museum; rival claimants trace to dealers and estates with gaps.",
    timer_seconds: 90, initial_ip: 8,
    tool_costs: { signature:1, metadata:1, financial:2 },
    credits: { source:"Public domain (Rijksmuseum/Wikimedia recommended)", attributions:["Johannes Vermeer (PD)"] },
    solution: {
      answer_index: 0,
      flags_signature:["Baseline of the monogram integrates with canvas weave, not later overpaint."],
      flags_metadata:["Thread count and technical file match; rivals rely on later registry notes."],
      flags_financial:["Insurance schedules align with long-standing museum records; rivals cite dealer stock notaries."],
      explanation:"Materials and documentation match the museum canvas; others follow copyist/dealer routes."
    }
  },

  /* === 002 Hokusai (B authentic) === */ {
    case_id:"002",
    brief:
      "A towering wave curls over boats with Fuji in the distance. Multiple printings and later editions exist; connoisseurship distinguishes early impressions from tourist runs.",
    images:["/hs/002/a.jpg","/hs/002/b.jpg","/hs/002/c.jpg"],
    signature_crops:["/hs/002/a_crop.jpg","/hs/002/b_crop.jpg","/hs/002/c_crop.jpg"],
    metadata:[
      { title:"Under the Wave off Kanagawa", year:"c. 1830–1832", medium:"Polychrome woodblock print (nishiki-e)",
        ownership_chain:["Edo period sale","Meiji export collection","Museum acquisition (20th-c.)"] },
      { title:"The Great Wave, early impression", year:"c. 1831", medium:"Polychrome woodblock print",
        ownership_chain:["Private Japanese collection","London dealer (1905)","Museum print room"] },
      { title:"Great Wave, later edition", year:"late 19th c.", medium:"Polychrome woodblock print",
        ownership_chain:["Commercial publisher stock","Tourist market (1900s)","Private collection"] },
    ],
    ledger_summary:"Competing sheets claim early vs. later impressions; provenance spans Edo/Meiji circulation to 20th-c. print rooms.",
    timer_seconds:90, initial_ip:8, tool_costs:{signature:1, metadata:1, financial:2},
    credits:{ source:"Public domain (Met/British Museum/Wikimedia)", attributions:["Katsushika Hokusai (PD)"] },
    solution:{
      answer_index:1,
      flags_signature:["Publisher cartouche and key-block wear indicate early state; foam hooks remain crisp."],
      flags_metadata:["Paper sizing and blues match early impressions; tourist sheets show later pigments and plate wear."],
      flags_financial:["Historic export/collection marks align with museum inflows; tourist sheets lack institutional trail."],
      explanation:"State features and paper support the early impression; the others reflect later/studio editions."
    }
  },

  /* === 003 Monet (C authentic) === */ {
    case_id:"003",
    brief:
      "A floating mat of lilies dissolves into color and reflection from Giverny. Several canvases share titles and sizes; cataloging leans on dealer archives and early exhibitions.",
    images:["/hs/003/a.jpg","/hs/003/b.jpg","/hs/003/c.jpg"],
    signature_crops:["/hs/003/a_crop.jpg","/hs/003/b_crop.jpg","/hs/003/c_crop.jpg"],
    metadata:[
      { title:"Nymphéas (Water Lilies)", year:"c. 1906", medium:"Oil on canvas",
        ownership_chain:["Artist’s studio","Durand-Ruel","Museum"] },
      { title:"Water Lily Pond", year:"after 1920", medium:"Oil on canvas",
        ownership_chain:["Private collection","Regional sale","Private collection"] },
      { title:"Nymphéas", year:"c. 1906", medium:"Oil on canvas",
        ownership_chain:["Durand-Ruel stock","Paris sale 1909","Museum"] },
    ],
    ledger_summary:"Dealer codes and exhibition lists help separate canonical canvases from later studio-circle pictures.",
    timer_seconds:90, initial_ip:8, tool_costs:{signature:1, metadata:1, financial:2},
    credits:{ source:"Public domain (Orsay/NGA/Wikimedia)", attributions:["Claude Monet (PD)"] },
    solution:{
      answer_index:2,
      flags_signature:["Signature orientation + paint handling match the 1906 group; rivals show retouching."],
      flags_metadata:["Dealer stock codes + 1909 sale cross-check; rivals lack early exhibition refs."],
      flags_financial:["Invoice trail via Durand-Ruel matches accession; others surface via regional sales."],
      explanation:"Dealer/exhibition records align with the canonical canvas; others are later or weakly documented."
    }
  },

  /* === 004 Van Gogh (A authentic) === */ {
    case_id:"004",
    brief:
      "A close self-portrait with rhythmic strokes against a blue-green ground. Numerous self-portraits exist; museums distinguish studio variants and later copies.",
    images:["/hs/004/a.jpg","/hs/004/b.jpg","/hs/004/c.jpg"],
    signature_crops:["/hs/004/a_crop.jpg","/hs/004/b_crop.jpg","/hs/004/c_crop.jpg"],
    metadata:[
      { title:"Self-Portrait", year:"1889", medium:"Oil on canvas",
        ownership_chain:["Family collection","Johanna van Gogh-Bonger","Museum"] },
      { title:"Self-Portrait (circle of)", year:"late 19th–early 20th c.", medium:"Oil on canvas",
        ownership_chain:["Private European collection","Auction 1950s","Private US collection"] },
      { title:"Self-Portrait (copy after)", year:"20th c.", medium:"Oil on board",
        ownership_chain:["Art-school collection","Studio dispersal","Private collection"] },
    ],
    ledger_summary:"Technical notes and family/dealer provenance remain central to authentication.",
    timer_seconds:90, initial_ip:8, tool_costs:{signature:1, metadata:1, financial:2},
    credits:{ source:"Public domain (Van Gogh Museum/NGA/Wikimedia)", attributions:["Vincent van Gogh (PD)"] },
    solution:{
      answer_index:0,
      flags_signature:["Impasto direction and underdrawing match the 1889 group."],
      flags_metadata:["Ground + canvas weave align with studio materials; copies use different supports."],
      flags_financial:["Family–Bonger dealer paperwork matches museum accession."],
      explanation:"Materials and provenance fit the 1889 corpus; competitors look like copies/derivatives."
    }
  },

  /* === 005 Turner (B authentic) === */ {
    case_id:"005",
    brief:
      "At sunset, an aged warship is towed toward its last berth. The image became emblematic of maritime memory, spawning prints and studio variants.",
    images:["/hs/005/a.jpg","/hs/005/b.jpg","/hs/005/c.jpg"],
    signature_crops:["/hs/005/a_crop.jpg","/hs/005/b_crop.jpg","/hs/005/c_crop.jpg"],
    metadata:[
      { title:"The Fighting Temeraire", year:"1839", medium:"Oil on canvas",
        ownership_chain:["Turner’s studio","National collection (early 20th c.)"] },
      { title:"The Fighting Temeraire", year:"1839", medium:"Oil on canvas",
        ownership_chain:["Patron purchase (1840s)","Bequest to nation","Museum"] },
      { title:"Temeraire, after Turner", year:"mid-19th c.", medium:"Oil on canvas",
        ownership_chain:["Print-seller stock","Victorian home","Regional sale"] },
    ],
    ledger_summary:"The national canvas is singular; 19th-century copies and print-shop derivatives circulate with partial trails.",
    timer_seconds:90, initial_ip:8, tool_costs:{signature:1, metadata:1, financial:2},
    credits:{ source:"Public domain (National Gallery London/Wikimedia)", attributions:["J. M. W. Turner (PD)"] },
    solution:{
      answer_index:1,
      flags_signature:["Varnish/glaze sequence matches studio method; copies flatten the sunset transitions."],
      flags_metadata:["National catalog + exhibition lists match; derivatives list print sellers."],
      flags_financial:["Bequest/transfer to nation is consistent; copies align to Victorian domestic markets."],
      explanation:"Catalog + exhibition history lead to the national canvas; others are copies/derivatives."
    }
  },
];
