import { citySuggestions } from "@/config/cities";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100)
    return Response.json({ cities: [] }, { headers: { "Cache-Control": "public, max-age=60" } });
  return Response.json(
    { cities: citySuggestions(query).map(({ city, region, latitude, longitude }) => ({ city, region, latitude, longitude })) },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
