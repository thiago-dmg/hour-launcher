import type { Frame, Page } from "@playwright/test";

export async function getSevenPaceFrame(page: Page): Promise<Frame> {
  const frame = page.frames().find((candidate) => candidate.url().includes("timehub.7pace.com"));

  if (!frame) {
    throw new Error("Frame do 7pace nao encontrado na pagina. Verifique se a tela Timesheet carregou corretamente.");
  }

  return frame;
}
