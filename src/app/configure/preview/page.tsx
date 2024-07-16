import { db } from "@/db";
import { DesignPreview } from "@/modules/design";
import { notFound } from "next/navigation";

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: { [key: string]: string };
}) {
  const { id } = searchParams;

  if (!id || typeof id !== "string") {
    return notFound();
  }

  const configuration = await db.configuration.findUnique({
    where: { id },
  });

  if (!configuration) {
    return notFound();
  }

  return <DesignPreview configuration={configuration} />;
}
