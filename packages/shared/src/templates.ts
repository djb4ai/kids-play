import {
  type CodexGameOutput,
  type AdaptiveGenerationContext,
  type GameRound,
  type Skill,
  type TemplateDefinition,
  type TemplateType
} from "./types";

const sharedFeedback = {
  correct: ["Great job!", "Well done!", "You are doing great!"],
  tryAgain: ["Nice try!", "Let's keep going!"],
  complete: ["Well done!", "You did it!"]
};

export const TEMPLATE_CATALOG: Record<TemplateType, TemplateDefinition> = {
  reading_word_match: {
    templateType: "reading_word_match",
    skill: "reading",
    title: "Match the Word",
    instructions: "Tap the picture that matches the letter clue.",
    description: "Letter and word recognition using familiar picture choices.",
    items: [
      { id: "apple", label: "Apple", imageKey: "apple", value: "A" },
      { id: "ball", label: "Ball", imageKey: "ball", value: "B" },
      { id: "book", label: "Book", imageKey: "book", value: "B" },
      { id: "cat", label: "Cat", imageKey: "cat", value: "C" },
      { id: "fish", label: "Fish", imageKey: "fish", value: "F" }
    ],
    rounds: [
      {
        id: "read_apple",
        prompt: "Tap the picture that starts with A.",
        choices: ["apple", "ball", "cat"],
        correctChoice: "apple"
      },
      {
        id: "read_book",
        prompt: "Tap the picture that starts with B.",
        choices: ["fish", "book", "cat"],
        correctChoice: "book"
      },
      {
        id: "read_cat",
        prompt: "Tap the picture that starts with C.",
        choices: ["ball", "apple", "cat"],
        correctChoice: "cat"
      }
    ]
  },
  reading_picture_clue: {
    templateType: "reading_picture_clue",
    skill: "reading",
    title: "Find the Picture",
    instructions: "Read the word, then tap the matching picture.",
    description: "Simple word-to-picture matching with familiar objects.",
    items: [
      { id: "sun", label: "Sun", imageKey: "sun", value: "sun" },
      { id: "book", label: "Book", imageKey: "book", value: "book" },
      { id: "fish", label: "Fish", imageKey: "fish", value: "fish" },
      { id: "tree", label: "Tree", imageKey: "tree", value: "tree" },
      { id: "moon", label: "Moon", imageKey: "moon", value: "moon" }
    ],
    rounds: [
      {
        id: "pic_sun",
        prompt: "Tap the picture for sun.",
        choices: ["sun", "book", "fish"],
        correctChoice: "sun"
      },
      {
        id: "pic_tree",
        prompt: "Tap the picture for tree.",
        choices: ["moon", "tree", "book"],
        correctChoice: "tree"
      },
      {
        id: "pic_fish",
        prompt: "Tap the picture for fish.",
        choices: ["book", "fish", "sun"],
        correctChoice: "fish"
      }
    ]
  },
  memory_sequence: {
    templateType: "memory_sequence",
    skill: "memory",
    title: "Remember the Row",
    instructions: "Watch the pictures, then tap them in the same order.",
    description: "Short visual sequence recall with two or three items.",
    items: [
      { id: "sun", label: "Sun", imageKey: "sun" },
      { id: "leaf", label: "Leaf", imageKey: "leaf" },
      { id: "star", label: "Star", imageKey: "star" },
      { id: "moon", label: "Moon", imageKey: "moon" },
      { id: "tree", label: "Tree", imageKey: "tree" }
    ],
    rounds: [
      {
        id: "mem_sun_leaf",
        prompt: "Remember this order.",
        choices: ["sun", "leaf", "star"],
        sequence: ["sun", "leaf"],
        correctSequence: ["sun", "leaf"]
      },
      {
        id: "mem_star_moon",
        prompt: "Remember this order.",
        choices: ["star", "moon", "tree"],
        sequence: ["star", "moon"],
        correctSequence: ["star", "moon"]
      },
      {
        id: "mem_leaf_tree_sun",
        prompt: "Remember this order.",
        choices: ["leaf", "tree", "sun", "moon"],
        sequence: ["leaf", "tree", "sun"],
        correctSequence: ["leaf", "tree", "sun"]
      }
    ]
  },
  memory_shape_path: {
    templateType: "memory_shape_path",
    skill: "memory",
    title: "Shape Path",
    instructions: "Watch the shapes, then tap the same path.",
    description: "Sequence recall using simple shapes and symbols.",
    items: [
      { id: "circle", label: "Circle", imageKey: "circle" },
      { id: "square", label: "Square", imageKey: "square" },
      { id: "star", label: "Star", imageKey: "star" },
      { id: "moon", label: "Moon", imageKey: "moon" },
      { id: "leaf", label: "Leaf", imageKey: "leaf" }
    ],
    rounds: [
      {
        id: "path_circle_star",
        prompt: "Remember this shape path.",
        choices: ["circle", "star", "square"],
        sequence: ["circle", "star"],
        correctSequence: ["circle", "star"]
      },
      {
        id: "path_square_leaf",
        prompt: "Remember this shape path.",
        choices: ["square", "leaf", "moon"],
        sequence: ["square", "leaf"],
        correctSequence: ["square", "leaf"]
      },
      {
        id: "path_star_moon_circle",
        prompt: "Remember this shape path.",
        choices: ["star", "moon", "circle", "leaf"],
        sequence: ["star", "moon", "circle"],
        correctSequence: ["star", "moon", "circle"]
      }
    ]
  },
  attention_target_tap: {
    templateType: "attention_target_tap",
    skill: "attention",
    title: "Find the Target",
    instructions: "Tap the target picture and let the others pass.",
    description: "Focused attention by selecting one target among distractors.",
    items: [
      { id: "star", label: "Star", imageKey: "star" },
      { id: "circle", label: "Circle", imageKey: "circle" },
      { id: "square", label: "Square", imageKey: "square" },
      { id: "moon", label: "Moon", imageKey: "moon" },
      { id: "leaf", label: "Leaf", imageKey: "leaf" }
    ],
    rounds: [
      {
        id: "att_star",
        prompt: "Tap the star.",
        choices: ["circle", "star", "square"],
        correctChoice: "star"
      },
      {
        id: "att_moon",
        prompt: "Tap the moon.",
        choices: ["leaf", "circle", "moon"],
        correctChoice: "moon"
      },
      {
        id: "att_leaf",
        prompt: "Tap the leaf.",
        choices: ["square", "leaf", "star"],
        correctChoice: "leaf"
      }
    ]
  },
  attention_shape_scan: {
    templateType: "attention_shape_scan",
    skill: "attention",
    title: "Shape Watch",
    instructions: "Look for the named shape and tap it.",
    description: "Attention practice with target shapes among distractors.",
    items: [
      { id: "circle", label: "Circle", imageKey: "circle" },
      { id: "square", label: "Square", imageKey: "square" },
      { id: "star", label: "Star", imageKey: "star" },
      { id: "sun", label: "Sun", imageKey: "sun" },
      { id: "moon", label: "Moon", imageKey: "moon" }
    ],
    rounds: [
      {
        id: "scan_circle",
        prompt: "Tap the circle.",
        choices: ["star", "circle", "moon"],
        correctChoice: "circle"
      },
      {
        id: "scan_square",
        prompt: "Tap the square.",
        choices: ["sun", "star", "square"],
        correctChoice: "square"
      },
      {
        id: "scan_sun",
        prompt: "Tap the sun.",
        choices: ["moon", "circle", "sun"],
        correctChoice: "sun"
      }
    ]
  },
  attention_codex_surprise: {
    templateType: "attention_codex_surprise",
    skill: "attention",
    title: "Moonlight Lookout",
    instructions: "Read the clue badge, then tap the matching helper.",
    description: "Flexible attention play with short clue badges and fresh focus prompts.",
    items: [
      { id: "night_moon", label: "Moon", imageKey: "moon", value: "night" },
      { id: "spark_star", label: "Star", imageKey: "star", value: "spark" },
      { id: "day_sun", label: "Sun", imageKey: "sun", value: "day" },
      { id: "soft_leaf", label: "Leaf", imageKey: "leaf", value: "soft" }
    ],
    rounds: [
      {
        id: "lookout_night",
        prompt: "Tap the helper with the night badge.",
        choices: ["night_moon", "day_sun", "spark_star"],
        correctChoice: "night_moon"
      },
      {
        id: "lookout_soft",
        prompt: "Tap the helper with the soft badge.",
        choices: ["spark_star", "soft_leaf", "day_sun"],
        correctChoice: "soft_leaf"
      },
      {
        id: "lookout_spark",
        prompt: "Tap the helper with the spark badge.",
        choices: ["spark_star", "night_moon"],
        correctChoice: "spark_star"
      }
    ]
  }
};

export const TEMPLATE_TYPES_BY_SKILL: Record<Skill, TemplateType[]> = {
  reading: ["reading_word_match", "reading_picture_clue"],
  memory: ["memory_sequence", "memory_shape_path"],
  attention: ["attention_target_tap", "attention_shape_scan"]
};

export function getTemplateForSkill(skill: Skill): TemplateDefinition {
  return TEMPLATE_CATALOG[TEMPLATE_TYPES_BY_SKILL[skill][0]];
}

export function createMockCodexOutput(
  skill: Skill,
  context?: AdaptiveGenerationContext
): CodexGameOutput {
  const template = getTemplateForSkill(skill);
  const output: CodexGameOutput = {
    skill,
    templateType: template.templateType,
    title: template.title,
    instructions: template.instructions,
    items: template.items.map((item) => ({ ...item })),
    rounds: template.rounds.map((round: GameRound) => ({ ...round })),
    feedback: {
      correct: [...sharedFeedback.correct],
      tryAgain: [...sharedFeedback.tryAgain],
      complete: [...sharedFeedback.complete]
    }
  };

  if (!context || context.recentTrend === "new") {
    return output;
  }

  if (skill === "reading") {
    return adaptReadingOutput(output, context);
  }

  if (skill === "memory") {
    return adaptMemoryOutput(output, context);
  }

  return adaptAttentionOutput(output, context);
}

export function getTemplateCatalogForPrompt() {
  return Object.values(TEMPLATE_CATALOG).map((template) => ({
    templateType: template.templateType,
    skill: template.skill,
    title: template.title,
    instructions: template.instructions,
    description: template.description,
    allowedItemIds: template.items.map((item) => item.id),
    sampleItems: template.items,
    sampleRounds: template.rounds
  }));
}

function adaptReadingOutput(
  output: CodexGameOutput,
  context: AdaptiveGenerationContext
): CodexGameOutput {
  const focusIds = getFocusItemIds(output, context);
  const targets = fillTargets(focusIds, getRoundTargets(output));
  const choiceCount = context.targetDifficultyLevel <= 1 ? 2 : 3;

  return {
    ...output,
    title:
      context.recentTrend === "needs_support"
        ? "Reading Gentle Repeat"
        : "Reading Next Step",
    instructions:
      context.recentTrend === "needs_support"
        ? "Try the familiar words again."
        : "Read each clue and tap the match.",
    rounds: targets.slice(0, 3).map((targetId, index) => {
      const target = output.items.find((item) => item.id === targetId);
      return {
        id: `adapt_read_${index + 1}`,
        prompt: target?.value
          ? `Tap the picture for ${target.label}.`
          : `Tap ${target?.label ?? targetId}.`,
        choices: buildChoices(output, targetId, choiceCount),
        correctChoice: targetId
      };
    })
  };
}

function adaptMemoryOutput(
  output: CodexGameOutput,
  context: AdaptiveGenerationContext
): CodexGameOutput {
  const sequenceLength = context.targetDifficultyLevel <= 1 ? 2 : 3;
  const ids = output.items.map((item) => item.id);

  return {
    ...output,
    title:
      context.recentTrend === "ready_for_more"
        ? "Memory Next Step"
        : "Memory Gentle Repeat",
    instructions:
      context.recentTrend === "ready_for_more"
        ? "Watch the row and try one more step."
        : "Watch a short row, then tap it back.",
    rounds: [0, 1, 2].map((offset) => {
      const sequence = rotate(ids, offset).slice(0, sequenceLength);
      return {
        id: `adapt_memory_${offset + 1}`,
        prompt: "Remember this order.",
        choices: rotate(ids, offset).slice(0, Math.max(sequenceLength + 1, 3)),
        sequence,
        correctSequence: [...sequence]
      };
    })
  };
}

function adaptAttentionOutput(
  output: CodexGameOutput,
  context: AdaptiveGenerationContext
): CodexGameOutput {
  const choiceCount = context.targetDifficultyLevel <= 1 ? 2 : 3;
  const targets = getRoundTargets(output);

  return {
    ...output,
    title:
      context.recentTrend === "ready_for_more"
        ? "Focus Next Step"
        : "Focus Gentle Repeat",
    instructions:
      context.recentTrend === "ready_for_more"
        ? "Find the target with one new distractor."
        : "Find the target with fewer choices.",
    rounds: targets.slice(0, 3).map((targetId, index) => {
      const target = output.items.find((item) => item.id === targetId);
      return {
        id: `adapt_focus_${index + 1}`,
        prompt: `Tap the ${target?.label.toLowerCase() ?? targetId}.`,
        choices: buildChoices(output, targetId, choiceCount),
        correctChoice: targetId
      };
    })
  };
}

function getFocusItemIds(
  output: CodexGameOutput,
  context: AdaptiveGenerationContext
) {
  const itemIds = new Set(output.items.map((item) => item.id));
  const normalizedLabels = new Map(
    output.items.map((item) => [item.label.toLowerCase(), item.id])
  );
  const mistakes = context.lastSession?.commonMistakes ?? [];

  return mistakes
    .map((mistake) => {
      const normalized = mistake.toLowerCase();
      return itemIds.has(normalized)
        ? normalized
        : normalizedLabels.get(normalized) ?? null;
    })
    .filter((itemId): itemId is string => Boolean(itemId));
}

function getRoundTargets(output: CodexGameOutput) {
  const targets = output.rounds
    .map((round) => round.correctChoice)
    .filter((target): target is string => Boolean(target));

  return targets.length > 0
    ? targets
    : output.items.slice(0, 3).map((item) => item.id);
}

function buildChoices(
  output: CodexGameOutput,
  targetId: string,
  count: number
) {
  const others = output.items
    .map((item) => item.id)
    .filter((itemId) => itemId !== targetId);

  return [targetId, ...others].slice(0, count);
}

function fillTargets(primary: string[], fallback: string[]) {
  const targets = [...new Set([...primary, ...fallback])];

  while (targets.length < 3 && fallback.length > 0) {
    targets.push(fallback[targets.length % fallback.length]);
  }

  return targets.slice(0, 3);
}

function rotate<T>(values: T[], offset: number) {
  return [...values.slice(offset), ...values.slice(0, offset)];
}
