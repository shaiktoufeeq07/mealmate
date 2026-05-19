import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

export const Route = createFileRoute("/api/meals")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const { ingredients, phase, targets } = (await request.json()) as {
            ingredients: string[];
            phase: string;
            targets: { kcal: number; protein: number; carbs: number; fat: number };
          };

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const gateway = createLovableAiGatewayProvider(apiKey);
          const model = gateway("google/gemini-3-flash-preview");

          const { output } = await generateText({
            model,
            output: Output.object({
              schema: z.object({
                meals: z
                  .array(
                    z.object({
                      name: z.string(),
                      kcal: z.number(),
                      protein: z.number(),
                      carbs: z.number(),
                      fat: z.number(),
                      description: z.string(),
                    }),
                  )
                  .length(3),
              }),
            }),
            prompt: `You are a nutrition coach. The user is in a ${phase} phase with daily targets of ${targets.kcal} kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat. Using ONLY these ingredients (plus basic pantry staples like oil, salt, spices): ${ingredients.join(", ")}. Suggest exactly 3 distinct meals that fit the phase's macro profile (roughly 1/3 of daily targets each). Keep descriptions to one short sentence.`,
          });

          return Response.json(output);
        } catch (e) {
          console.error("meals route error", e);
          return new Response("Failed to generate meals", { status: 500 });
        }
      },
    },
  },
});
