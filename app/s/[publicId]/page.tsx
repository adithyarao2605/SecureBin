import { Viewer } from "./viewer";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <Viewer publicId={publicId} />;
}
