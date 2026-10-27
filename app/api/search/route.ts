import { searchProperties } from "@/actions/searchProperties";

// GET /api/search?q=Studio+near+the+Green+line+within+a+10+min+walk
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const result = await searchProperties(query);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
