import { expect, it } from "vitest";
import { citySuggestions } from "@/config/cities";
it("offers bounded, case-insensitive city suggestions with valid coordinates", () => {
  expect(citySuggestions("  pUn  ")[0]).toMatchObject({ city: "Pune", region: "Maharashtra", countryCode: "IN" });
  expect(citySuggestions("" )).toEqual([]);
  expect(citySuggestions("a city entered manually")).toEqual([]);
  const results = citySuggestions("de");
  expect(results.length).toBeLessThanOrEqual(5);
  for (const place of results) {
    expect(place.latitude).toBeGreaterThanOrEqual(-90);
    expect(place.latitude).toBeLessThanOrEqual(90);
    expect(place.longitude).toBeGreaterThanOrEqual(-180);
    expect(place.longitude).toBeLessThanOrEqual(180);
  }
});
