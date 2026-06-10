import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

export async function confirmReview(question = "Confirmar? (Sim/Nao) "): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === "sim" || answer === "s" || answer === "yes" || answer === "y";
  } finally {
    rl.close();
  }
}
