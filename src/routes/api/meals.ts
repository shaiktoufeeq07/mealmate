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
          const { ingredients, phase, targets, weight, avoid } = (await request.json()) as {
            ingredients: string[];
            phase: string;
            targets: { kcal: number; protein: number; carbs: number; fat: number };
            weight?: number;
            avoid?: string[];
          };

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const gateway = createLovableAiGatewayProvider(apiKey);
          const model = gateway("google/gemini-3-flash-preview");

          const styles = [
            "bowl, skillet, wrap",
            "stir-fry, salad, soup",
            "grilled plate, curry, hash",
            "sheet-pan, noodle dish, frittata",
            "tacos, stew, rice bowl",
          ];
          const cuisines = ["Mediterranean", "Mexican", "Japanese", "Indian", "Italian", "Korean", "Middle Eastern", "Thai"];
          const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
          const styleHint = pick(styles);
          const cuisineHint = `${pick(cuisines)} and ${pick(cuisines)}`;
          const variationSeed = Math.random().toString(36).slice(2, 8);

          const avoidLine =
            avoid && avoid.length
              ? `Do NOT repeat or closely resemble any of these previously suggested meals: ${avoid.slice(-30).join("; ")}. Pick clearly different dishes, cooking methods, and flavour profiles.`
              : "";

          const { output } = await generateText({
            model,
            temperature: 0.95,
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
            prompt: `You are a creative nutrition coach. The user weighs ${weight ?? "unknown"}kg and is in a ${phase} phase. Their daily targets (already personalised to their bodyweight) are ${targets.kcal} kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat. Using ONLY these ingredients (plus basic pantry staples like oil, salt, spices, herbs): ${ingredients.join(", ")}. Suggest exactly 3 distinct meals that fit the phase's macro profile (roughly 1/3 of daily targets each) and are clearly tuned for a ${phase} (Bulk = calorie-dense, Lean Bulk = balanced, Cut = high-protein low-cal). Scale portions for a ${weight ?? 75}kg person. ${avoidLine} Aim for variety in formats (try ${styleHint}) and flavours (lean toward ${cuisineHint}). Each meal name and macro mix must be different from the others. Keep descriptions to one short sentence. Variation seed: ${variationSeed}.`,
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
