// src/server/mockCases.ts

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

// ---------------------------------------------------------------------------
// 5 cases (authentic always a.jpg / answer_index: 0)
// ---------------------------------------------------------------------------
export const MOCK_CASES: MockCase[] = [

  /* === 001 Vermeer === */
  {
    case_id: "001",
    brief:
      "Johannes Vermeer, The Milkmaid: Vermeer’s work elevates a simple domestic scene into a moment of quiet dignity and focus, celebrated for its masterful use of light and texture. A rediscovered version is claimed; curators request an independent review.",
    images: ["/hs/001/a.jpg","/hs/001/b.jpg","/hs/001/c.jpg"],
    signature_crops: ["/hs/001/a_crop.jpg","/hs/001/b_crop.jpg","/hs/001/c_crop.jpg"],
    metadata: [
      { title:"The Milkmaid", year:"c. 1657–1658", medium:"Oil on canvas",
        ink_or_pigment:"Lead white, natural ultramarine, earth pigments",
        catalog_ref:"Catalogue raisonné, Vermeer no. 10",
        ownership_chain:["17th-c. Dutch private collection","19th-c. Amsterdam collection","Museum holding (20th-c.–)"] },
      { title:"Kitchen Maid (after Vermeer)", year:"late 19th c.", medium:"Oil on canvas" },
      { title:"Dairymaid, attributed", year:"c. 1650s/after", medium:"Oil on canvas" },
    ],
    ledger_summary:"A Golden Age painting passes through Dutch hands into a museum; rivals trace to dealers and estates with gaps.",
    timer_seconds:90, initial_ip:8,
    tool_costs:{ signature:1, metadata:1, financial:2 },
    credits:{ source:"Public domain (Rijksmuseum/Wikimedia)", attributions:["Johannes Vermeer (PD)"] },
    solution:{
      answer_index:0,
      flags_signature:["Monogram integrates with canvas weave, not later overpaint."],
      flags_metadata:["Thread count and technical file match; rivals rely on later registry notes."],
      flags_financial:["Insurance schedules align with museum records; rivals cite dealer stock notaries."],
      explanation:"Materials and documentation match the museum canvas; others follow copyist/dealer routes."
    }
  },

  /* === 002 Hokusai === */
  {
    case_id:"002",
    brief:
      "Katsushika Hokusai, Under the Wave off Kanagawa: This iconic Japanese woodblock print captures the dramatic power of nature as a massive wave looms over three boats, with the sacred Mount Fuji serene in the distance. Multiple printings and later editions exist; specialists examine impression state to identify authentic sheets.",
    images:["/hs/002/a.jpg","/hs/002/b.jpg","/hs/002/c.jpg"],
    signature_crops:["/hs/002/a_crop.jpg","/hs/002/b_crop.jpg","/hs/002/c_crop.jpg"],
    metadata:[
      { title:"Under the Wave off Kanagawa", year:"c. 1830–1832", medium:"Polychrome woodblock print (nishiki-e)" },
      { title:"Great Wave, early impression", year:"c. 1831", medium:"Polychrome woodblock print" },
      { title:"Great Wave, later edition", year:"late 19th c.", medium:"Polychrome woodblock print" },
    ],
    ledger_summary:"Provenance spans Edo/Meiji circulation to 20th-c. print rooms; impression state is key.",
    timer_seconds:90, initial_ip:8, tool_costs:{signature:1, metadata:1, financial:2},
    credits:{ source:"Public domain (Met/British Museum/Wikimedia)", attributions:["Katsushika Hokusai (PD)"] },
    solution:{
      answer_index:0,
      flags_signature:["Publisher cartouche and key-block wear indicate early state."],
      flags_metadata:["Paper sizing and blues match early impressions; tourist sheets show later pigments."],
      flags_financial:["Historic export/collection marks align with museum inflows; tourist sheets lack trail."],
      explanation:"State features and paper support the early impression; the others reflect later/studio editions."
    }
  },

  /* === 003 Monet === */
  {
    case_id:"003",
    brief:
      "Claude Monet, Water Lilies: Part of a celebrated series, this painting captures the ever-changing light and reflections on the surface of Monet’s water garden, dissolving form into a rich tapestry of color. Several canvases share titles; investigators must clarify which align with the 1906 dealer and exhibition records.",
    images:["/hs/003/a.jpg","/hs/003/b.jpg","/hs/003/c.jpg"],
    signature_crops:["/hs/003/a_crop.jpg","/hs/003/b_crop.jpg","/hs/003/c_crop.jpg"],
    metadata:[
      { title:"Nymphéas (Water Lilies)", year:"c. 1906", medium:"Oil on canvas" },
      { title:"Water Lily Pond", year:"after 1920", medium:"Oil on canvas" },
      { title:"Nymphéas", year:"c. 1906", medium:"Oil on canvas" },
    ],
    ledger_summary:"Dealer codes and exhibition lists help separate canonical canvases from later studio-circle pictures.",
    timer_seconds:90, initial_ip:8, tool_costs:{signature:1, metadata:1, financial:2},
    credits:{ source:"Public domain (Orsay/NGA/Wikimedia)", attributions:["Claude Monet (PD)"] },
    solution:{
      answer_index:0,
      flags_signature:["Signature orientation and paint handling match the 1906 group."],
      flags_metadata:["Dealer stock codes + 1909 sale cross-check; rivals lack exhibition refs."],
      flags_financial:["Invoice trail via Durand-Ruel matches accession; others surface via regional sales."],
      explanation:"Dealer/exhibition records align with the canonical canvas; others are later or weakly documented."
    }
  },

  /* === 004 Van Gogh === */
  {
    case_id:"004",
    brief:
      "Vincent van Gogh, Self-Portrait: A powerful and psychologically intense work, this self-portrait shows the artist’s turbulent inner world through his signature swirling brushstrokes and piercing gaze. Numerous versions exist; museums distinguish studio variants and later copies, prompting careful review.",
    images:["/hs/004/a.jpg","/hs/004/b.jpg","/hs/004/c.jpg"],
    signature_crops:["/hs/004/a_crop.jpg","/hs/004/b_crop.jpg","/hs/004/c_crop.jpg"],
    metadata:[
      { title:"Self-Portrait", year:"1889", medium:"Oil on canvas" },
      { title:"Self-Portrait (circle of)", year:"late 19th–early 20th c.", medium:"Oil on canvas" },
      { title:"Self-Portrait (copy after)", year:"20th c.", medium:"Oil on board" },
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

  /* === 005 Turner === */
  {
    case_id:"005",
    brief:
      "J. M. W. Turner, The Fighting Temeraire: This painting is a poignant tribute to a bygone era, as a majestic, ghostly warship is towed to its final resting place by a modern steam tug, set against a fiery sunset. Studio copies and Victorian prints abound; conservators review claims to isolate the national canvas.",
    images:["/hs/005/a.jpg","/hs/005/b.jpg","/hs/005/c.jpg"],
    signature_crops:["/hs/005/a_crop.jpg","/hs/005/b_crop.jpg","/hs/005/c_crop.jpg"],
    metadata:[
      { title:"The Fighting Temeraire", year:"1839", medium:"Oil on canvas" },
      { title:"The Fighting Temeraire", year:"1839", medium:"Oil on canvas" },
      { title:"Temeraire, after Turner", year:"mid-19th c.", medium:"Oil on canvas" },
    ],
    ledger_summary:"The national canvas is singular; 19th-century copies and print-shop derivatives circulate with partial trails.",
    timer_seconds:90, initial_ip:8, tool_costs:{signature:1, metadata:1, financial:2},
    credits:{ source:"Public domain (National Gallery London/Wikimedia)", attributions:["J. M. W. Turner (PD)"] },
    solution:{
      answer_index:0,
      flags_signature:["Varnish/glaze sequence matches studio method; copies flatten the sunset transitions."],
      flags_metadata:["National catalog + exhibition lists match; derivatives list print sellers."],
      flags_financial:["Bequest/transfer to nation is consistent; copies align to Victorian domestic markets."],
      explanation:"Catalog + exhibition history lead to the national canvas; others are copies/derivatives."
    }
  },
];
