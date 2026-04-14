"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTIONS } from "@/lib/diagnosis";

export default function QuizPage() {
  const router = useRouter();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);

  const question = QUESTIONS[currentQ];
  const progress = ((currentQ) / QUESTIONS.length) * 100;

  function selectAnswer(label: string) {
    if (question.multiSelect) {
      setSelectedMulti((prev) =>
        prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
      );
      return;
    }

    const newAnswers = { ...answers, [question.id]: label };
    setAnswers(newAnswers);

    // Auto-advance after short delay
    setTimeout(() => {
      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ(currentQ + 1);
      } else {
        // Save to sessionStorage and go to results
        sessionStorage.setItem("diagnosis_answers", JSON.stringify(newAnswers));
        router.push("/diagnosis/result");
      }
    }, 300);
  }

  function confirmMultiSelect() {
    const newAnswers = {
      ...answers,
      [question.id]: selectedMulti.length > 0 ? selectedMulti : ["なし"],
    };
    setAnswers(newAnswers);
    setSelectedMulti([]);

    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      sessionStorage.setItem("diagnosis_answers", JSON.stringify(newAnswers));
      router.push("/diagnosis/result");
    }
  }

  function goBack() {
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
      setSelectedMulti([]);
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col p-4 max-w-sm mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={goBack}
            className={`text-sm ${currentQ > 0 ? "text-primary" : "text-transparent"}`}
          >
            ← 戻る
          </button>
          <span className="text-xs text-muted-foreground">
            {currentQ + 1} / {QUESTIONS.length}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col">
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold mb-1">{question.title}</h2>
          {question.subtitle && (
            <p className="text-xs text-muted-foreground">{question.subtitle}</p>
          )}
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          {question.options.map((option) => {
            const isSelected = question.multiSelect
              ? selectedMulti.includes(option.label)
              : answers[question.id] === option.label;

            return (
              <button
                key={option.label}
                onClick={() => selectAnswer(option.label)}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 text-sm transition-all active:scale-95 ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-bold scale-[1.02]"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <span className="text-3xl">{option.icon}</span>
                <span className="text-center leading-tight">{option.label}</span>
              </button>
            );
          })}
        </div>

        {/* Multi-select confirm button */}
        {question.multiSelect && (
          <button
            onClick={confirmMultiSelect}
            className="mt-4 w-full h-12 bg-primary text-primary-foreground rounded-lg font-bold text-base"
          >
            {selectedMulti.length > 0
              ? `${selectedMulti.length}個選択して次へ`
              : "スキップ"}
          </button>
        )}
      </div>
    </div>
  );
}
