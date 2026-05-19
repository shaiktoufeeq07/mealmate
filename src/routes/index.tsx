import { createFileRoute } from "@tanstack/react-router";
import MealMateApp from "@/components/MealMateApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MealMate — AI Nutrition & Training Coach" },
      { name: "description", content: "MealMate mobile prototype: track meals, gym sessions, and get AI phase recommendations." },
    ],
  }),
  component: () => <MealMateApp />,
});
