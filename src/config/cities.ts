import type { Place } from "@/server/location/service";

// City centres are suggestions; venue entrances must be chosen separately.
export const cities: Place[] = [
  ["New Delhi", "Delhi", 28.6139, 77.2090],
  ["Delhi", "Delhi", 28.6139, 77.2090],
  ["Mumbai", "Maharashtra", 19.0760, 72.8777],
  ["Pune", "Maharashtra", 18.5204, 73.8567],
  ["Bengaluru", "Karnataka", 12.9716, 77.5946],
  ["Hyderabad", "Telangana", 17.3850, 78.4867],
  ["Chennai", "Tamil Nadu", 13.0827, 80.2707],
  ["Kolkata", "West Bengal", 22.5726, 88.3639],
  ["Ahmedabad", "Gujarat", 23.0225, 72.5714],
  ["Jaipur", "Rajasthan", 26.9124, 75.7873],
  ["Lucknow", "Uttar Pradesh", 26.8467, 80.9462],
  ["Ghaziabad", "Uttar Pradesh", 28.6692, 77.4538],
  ["Noida", "Uttar Pradesh", 28.5355, 77.3910],
  ["Gurugram", "Haryana", 28.4595, 77.0266],
  ["Chandigarh", "Chandigarh", 30.7333, 76.7794],
  ["Indore", "Madhya Pradesh", 22.7196, 75.8577],
  ["Bhopal", "Madhya Pradesh", 23.2599, 77.4126],
  ["Kochi", "Kerala", 9.9312, 76.2673],
  ["Panaji", "Goa", 15.4909, 73.8278],
  ["Surat", "Gujarat", 21.1702, 72.8311],
  ["Nagpur", "Maharashtra", 21.1458, 79.0882],
  ["Patna", "Bihar", 25.5941, 85.1376],
  ["Bhubaneswar", "Odisha", 20.2961, 85.8245],
  ["Guwahati", "Assam", 26.1445, 91.7362],
  ["Dehradun", "Uttarakhand", 30.3165, 78.0322],
  ["Varanasi", "Uttar Pradesh", 25.3176, 82.9739],
].map(([city, region, latitude, longitude]) => ({
  city: String(city), region: String(region), countryCode: "IN",
  label: `${city}, ${region}, India`, latitude: Number(latitude), longitude: Number(longitude),
}));

export function citySuggestions(query: string) {
  const needle = query.trim().toLocaleLowerCase("en-IN");
  return needle.length < 2 ? [] : cities.filter(place => place.city.toLocaleLowerCase("en-IN").includes(needle)).slice(0, 5);
}
