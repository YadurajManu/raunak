/**
 * Metro line names, cities and color mappings for major Indian transit systems.
 * Supports Delhi, Mumbai, Bangalore, Hyderabad, Chennai, Kolkata, Pune.
 */

export type MetroLineDefinition = {
  name: string;
  color: string;
  city: string;
  aliases: string[];
};

export const METRO_LINES: MetroLineDefinition[] = [
  // Delhi Metro (DMRC) & Noida/Gurugram
  {
    name: "Yellow Line",
    color: "#FFD700",
    city: "Delhi",
    aliases: ["yellow", "samaypur badli to huda city", "millennium city", "line 2"],
  },
  {
    name: "Blue Line",
    color: "#0066CC",
    city: "Delhi",
    aliases: ["blue", "dwarka to noida", "vaishali", "line 3", "line 4"],
  },
  {
    name: "Red Line",
    color: "#D32F2F",
    city: "Delhi",
    aliases: ["red", "rithala to shaheed sthal", "line 1"],
  },
  {
    name: "Violet Line",
    color: "#7B1FA2",
    city: "Delhi",
    aliases: ["violet", "kashmere gate to raja nahar singh", "line 6"],
  },
  {
    name: "Pink Line",
    color: "#EC407A",
    city: "Delhi",
    aliases: ["pink", "majlis park to shiv vihar", "line 7"],
  },
  {
    name: "Magenta Line",
    color: "#C2185B",
    city: "Delhi",
    aliases: ["magenta", "janakpuri west to botanical garden", "line 8"],
  },
  {
    name: "Green Line",
    color: "#2E7D32",
    city: "Delhi",
    aliases: ["green", "inderlok to brigadier hoshiyar singh", "line 5"],
  },
  {
    name: "Orange Line (Airport Express)",
    color: "#FF9800",
    city: "Delhi",
    aliases: ["orange", "airport express", "new delhi to yashobhoomi"],
  },
  {
    name: "Grey Line",
    color: "#78909C",
    city: "Delhi",
    aliases: ["grey", "gray", "dwarka to dhansa bus stand", "line 9"],
  },
  {
    name: "Aqua Line",
    color: "#00BCD4",
    city: "Delhi",
    aliases: ["aqua", "noida metro", "noida-greater noida"],
  },
  {
    name: "Rapid Metro",
    color: "#0288D1",
    city: "Delhi",
    aliases: ["rapid metro", "gurugram rapid", "cyber city"],
  },

  // Mumbai Metro (MMRDA)
  {
    name: "Blue Line (Line 1)",
    color: "#0288D1",
    city: "Mumbai",
    aliases: ["mumbai line 1", "versova-andheri-ghatkopar", "mumbai blue"],
  },
  {
    name: "Yellow Line (Line 2A/2B)",
    color: "#FFD700",
    city: "Mumbai",
    aliases: ["mumbai line 2", "dahisar to mandale", "mumbai yellow"],
  },
  {
    name: "Aqua Line (Line 3)",
    color: "#00ACC1",
    city: "Mumbai",
    aliases: ["mumbai line 3", "colaba-seepz", "underground metro", "mumbai aqua"],
  },
  {
    name: "Green Line (Line 4)",
    color: "#388E3C",
    city: "Mumbai",
    aliases: ["mumbai line 4", "wadala to kasarvadavali", "mumbai green"],
  },
  {
    name: "Red Line (Line 7)",
    color: "#E53935",
    city: "Mumbai",
    aliases: ["mumbai line 7", "dahisar east to andheri east", "mumbai red"],
  },

  // Bangalore (Namma Metro)
  {
    name: "Purple Line",
    color: "#7B1FA2",
    city: "Bengaluru",
    aliases: ["purple", "bengaluru purple", "whitefield to challaghatta"],
  },
  {
    name: "Green Line",
    color: "#2E7D32",
    city: "Bengaluru",
    aliases: ["bengaluru green", "nagasandra to silk institute"],
  },
  {
    name: "Yellow Line",
    color: "#FBC02D",
    city: "Bengaluru",
    aliases: ["bengaluru yellow", "rv road to bommasandra"],
  },
  {
    name: "Pink Line",
    color: "#E91E63",
    city: "Bengaluru",
    aliases: ["bengaluru pink", "kalena agrahara to nagawara"],
  },

  // Hyderabad Metro
  {
    name: "Red Line (Corridor 1)",
    color: "#D32F2F",
    city: "Hyderabad",
    aliases: ["hyderabad red", "miyapur to l.b. nagar", "corridor 1"],
  },
  {
    name: "Blue Line (Corridor 3)",
    color: "#1565C0",
    city: "Hyderabad",
    aliases: ["hyderabad blue", "nagole to raidurg", "corridor 3", "hitec city"],
  },
  {
    name: "Green Line (Corridor 2)",
    color: "#2E7D32",
    city: "Hyderabad",
    aliases: ["hyderabad green", "jbs to mgbs", "corridor 2"],
  },

  // Chennai Metro
  {
    name: "Blue Line",
    color: "#1565C0",
    city: "Chennai",
    aliases: ["chennai blue", "wimco nagar to chennai airport", "chennai line 1"],
  },
  {
    name: "Green Line",
    color: "#2E7D32",
    city: "Chennai",
    aliases: ["chennai green", "chennai central to st thomas mount", "chennai line 2"],
  },

  // Kolkata Metro
  {
    name: "Blue Line (Line 1)",
    color: "#1565C0",
    city: "Kolkata",
    aliases: ["kolkata blue", "dakshineswar to kavi subhash", "kolkata line 1"],
  },
  {
    name: "Green Line (Line 2)",
    color: "#2E7D32",
    city: "Kolkata",
    aliases: ["kolkata green", "howrah to salt lake", "underwater metro", "kolkata line 2"],
  },
  {
    name: "Purple Line (Line 3)",
    color: "#6A1B9A",
    city: "Kolkata",
    aliases: ["kolkata purple", "joka to taratala", "kolkata line 3"],
  },
  {
    name: "Orange Line (Line 6)",
    color: "#E65100",
    city: "Kolkata",
    aliases: ["kolkata orange", "kavi subhash to airport", "kolkata line 6"],
  },

  // Pune Metro
  {
    name: "Purple Line",
    color: "#7B1FA2",
    city: "Pune",
    aliases: ["pune purple", "pcmc to swargate", "pune line 1"],
  },
  {
    name: "Aqua Line",
    color: "#00ACC1",
    city: "Pune",
    aliases: ["pune aqua", "vanaz to ramwadi", "pune line 2"],
  },
];

export const NEUTRAL_METRO_COLOR = "#71717A";

/**
 * Validates whether a given string is a valid 3-digit or 6-digit hex color.
 */
export function isValidHexColor(color: string | null | undefined): boolean {
  if (!color) return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color.trim());
}

export type MatchMetroLineOptions = {
  stationName?: string | null;
  lineName?: string | null;
  city?: string | null;
  osmColor?: string | null;
};

// Known station name -> line mappings for common stations in Indian metros
const KNOWN_STATION_LINES: Record<string, { lineName: string; color: string; city: string }> = {
  saket: { lineName: "Yellow Line", color: "#FFD700", city: "Delhi" },
  "malviya nagar": { lineName: "Yellow Line", color: "#FFD700", city: "Delhi" },
  "hauz khas": { lineName: "Yellow Line", color: "#FFD700", city: "Delhi" },
  "rajiv chowk": { lineName: "Yellow Line", color: "#FFD700", city: "Delhi" },
  "mandi house": { lineName: "Blue Line", color: "#0066CC", city: "Delhi" },
  "kashmere gate": { lineName: "Red Line", color: "#D32F2F", city: "Delhi" },
  "central secretariat": { lineName: "Yellow Line", color: "#FFD700", city: "Delhi" },
  ghatkopar: { lineName: "Line 1 (Blue Line)", color: "#0066CC", city: "Mumbai" },
  andheri: { lineName: "Line 1 (Blue Line)", color: "#0066CC", city: "Mumbai" },
  versova: { lineName: "Line 1 (Blue Line)", color: "#0066CC", city: "Mumbai" },
  "mg road": { lineName: "Purple Line", color: "#7B1FA2", city: "Bengaluru" },
  indiranagar: { lineName: "Purple Line", color: "#7B1FA2", city: "Bengaluru" },
  majestic: { lineName: "Purple Line", color: "#7B1FA2", city: "Bengaluru" },
  whitefield: { lineName: "Purple Line", color: "#7B1FA2", city: "Bengaluru" },
  "hitec city": { lineName: "Blue Line", color: "#0066CC", city: "Hyderabad" },
  raidurg: { lineName: "Blue Line", color: "#0066CC", city: "Hyderabad" },
  "chennai central": { lineName: "Blue Line", color: "#0066CC", city: "Chennai" },
  "park street": { lineName: "Blue Line (Line 1)", color: "#0066CC", city: "Kolkata" },
  shivajinagar: { lineName: "Purple Line (Line 1)", color: "#7B1FA2", city: "Pune" },
};

/**
 * Matches a transit line name or OSM tag to a standardized metro line name and hex color.
 * Priority:
 * 1. If valid OSM colour tag is supplied, respect it.
 * 2. Match known station or fuzzy match line name and city against known lines.
 * 3. Fall back to clean line name and neutral grey (#71717A).
 */
export function matchMetroLine(
  arg1?: string | null | MatchMetroLineOptions,
  arg2?: string | null,
  arg3?: string | null,
): {
  lineName: string;
  color: string;
  city?: string;
} {
  let stationName = "";
  let lineName = "";
  let city = "";
  let osmColor = "";

  if (typeof arg1 === "object" && arg1 !== null) {
    stationName = (arg1.stationName || "").trim();
    lineName = (arg1.lineName || "").trim();
    city = (arg1.city || "").trim();
    osmColor = (arg1.osmColor || "").trim();
  } else {
    stationName = typeof arg1 === "string" ? arg1.trim() : "";
    lineName = typeof arg2 === "string" ? arg2.trim() : "";
    osmColor = typeof arg3 === "string" ? arg3.trim() : "";
  }

  // 1. If valid hex is explicitly provided in OSM data
  let customColor: string | null = null;
  if (osmColor) {
    const formatted = osmColor.startsWith("#") ? osmColor.trim() : `#${osmColor.trim()}`;
    if (isValidHexColor(formatted)) {
      customColor = formatted;
    }
  }

  const query = `${stationName} ${lineName}`.toLowerCase().trim();

  // 2. Direct station match if station is known
  const stationKey = stationName.toLowerCase();
  if (KNOWN_STATION_LINES[stationKey]) {
    const known = KNOWN_STATION_LINES[stationKey];
    if (!city) city = known.city;
    const lowerLine = lineName.toLowerCase();
    if (
      !lowerLine ||
      lowerLine === "metro" ||
      lowerLine === "line 1" ||
      known.lineName.toLowerCase().includes(lowerLine)
    ) {
      return {
        lineName: known.lineName,
        color: customColor || known.color,
        city: known.city,
      };
    }
  }

  // 3. City-first match
  const cleanCity = city.toLowerCase().trim();
  if (cleanCity) {
    const cityLines = METRO_LINES.filter(
      (item) =>
        cleanCity.includes(item.city.toLowerCase()) ||
        item.city.toLowerCase().includes(cleanCity),
    );
    for (const item of cityLines) {
      if (
        query.includes(item.name.toLowerCase()) ||
        item.aliases.some((alias) => query.includes(alias) || alias.includes(query))
      ) {
        return {
          lineName: item.name,
          color: customColor || item.color,
          city: item.city,
        };
      }
    }
  }

  // 4. Global fuzzy match against all known metro lines
  for (const item of METRO_LINES) {
    if (
      query.includes(item.name.toLowerCase()) ||
      item.aliases.some((alias) => query.includes(alias))
    ) {
      return {
        lineName: item.name,
        color: customColor || item.color,
        city: item.city,
      };
    }
  }

  // 5. Basic color name heuristic in query
  const colorKeywords: Record<string, string> = {
    yellow: "#FFD700",
    blue: "#0066CC",
    red: "#D32F2F",
    green: "#2E7D32",
    violet: "#7B1FA2",
    purple: "#7B1FA2",
    pink: "#EC407A",
    magenta: "#C2185B",
    orange: "#FF9800",
    aqua: "#00BCD4",
    grey: "#78909C",
    gray: "#78909C",
  };

  for (const [key, color] of Object.entries(colorKeywords)) {
    if (query.includes(key)) {
      const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
      return {
        lineName: lineName && lineName.toLowerCase().includes("line")
          ? lineName
          : `${capitalized} Line`,
        color: customColor || color,
      };
    }
  }

  // Check if station itself is known
  if (KNOWN_STATION_LINES[stationKey]) {
    const known = KNOWN_STATION_LINES[stationKey];
    return {
      lineName: lineName || known.lineName,
      color: customColor || known.color,
      city: known.city,
    };
  }

  // 6. Default fallback to neutral grey
  const fallbackLineName = lineName || (stationName ? `${stationName} Metro` : "Metro");
  return {
    lineName: fallbackLineName,
    color: customColor || NEUTRAL_METRO_COLOR,
  };
}
