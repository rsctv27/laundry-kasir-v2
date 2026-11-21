import { dispatch } from "@/server/router";
import { preflight } from "@/server/http";

type P = { params: Promise<{ path: string[] }> };
const handle = async (req: Request, { params }: P) => dispatch(req, (await params).path);

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = (req: Request) => preflight(req);
export const dynamic = "force-dynamic";
