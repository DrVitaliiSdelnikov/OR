import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { isAnswerCorrect, QUIZ_POINTS_PER_ANSWER, QuizTask, taskById } from '../../sim/tasks';
import { ProgressStore, TaskResult } from '../services/progress.store';

type AnswerState = 'pending' | 'correct' | 'wrong';

/** @deprecated Викторины стали шагами упражнений курса (`sim/course.ts`, COURSE.md), удалить в A2 (docs/code/REMOVAL-CANDIDATES.md). */
@Component({
  selector: 'or-quiz',
  imports: [IonContent, RouterLink],
  templateUrl: './quiz.page.html',
  styleUrl: './quiz.page.scss',
})
export class QuizPage {
  private readonly progress = inject(ProgressStore);
  readonly taskId = input.required<string>();

  protected readonly task = computed(() => taskById(this.taskId()) as QuizTask);
  protected readonly questionIndex = signal(0);
  protected readonly answerText = signal('');
  protected readonly answerState = signal<AnswerState>('pending');
  protected readonly score = signal(0);
  protected readonly result = signal<TaskResult | null>(null);
  protected readonly question = computed(() => this.task().questions[this.questionIndex()]);
  protected readonly isLastQuestion = computed(() => this.questionIndex() === this.task().questions.length - 1);
  protected readonly isInputInvalid = signal(false);

  protected check(): void {
    const value = Number.parseFloat(this.answerText().replace(',', '.'));
    if (!Number.isFinite(value)) {
      this.isInputInvalid.set(true);
      return;
    }
    this.isInputInvalid.set(false);
    const isCorrect = isAnswerCorrect(this.question(), value);
    this.answerState.set(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      this.score.update(score => score + QUIZ_POINTS_PER_ANSWER);
    }
  }

  protected next(): void {
    if (this.isLastQuestion()) {
      this.result.set(this.progress.recordTaskResult(this.task().id, this.score(), this.task().questions.length * QUIZ_POINTS_PER_ANSWER));
      return;
    }
    this.questionIndex.update(index => index + 1);
    this.answerText.set('');
    this.answerState.set('pending');
  }

  protected restart(): void {
    this.questionIndex.set(0);
    this.answerText.set('');
    this.answerState.set('pending');
    this.score.set(0);
    this.result.set(null);
  }

  protected starsText(stars: number): string {
    return '★'.repeat(stars) + '☆'.repeat(3 - stars);
  }

  protected formatAnswer(value: number): string {
    return String(value).replace('.', ',');
  }
}
