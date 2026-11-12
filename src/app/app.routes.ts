import type { PositionPage } from './position/position.page';
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./home/home.page').then(module => module.HomePage) },
  { path: 'course', loadComponent: () => import('./course/course-trail.page').then(module => module.CourseTrailPage) },
  { path: 'course/:exerciseId', loadComponent: () => import('./course/exercise-sheet.page').then(module => module.ExerciseSheetPage) },
  { path: 'position/:exerciseId', loadComponent: () => import('./position/position.page').then(module => module.PositionPage), canDeactivate: [(page: PositionPage) => page.canLeave()] },
  { path: 'free', loadComponent: () => import('./free/free-play.page').then(module => module.FreePlayPage) },
  { path: 'settings', loadComponent: () => import('./settings/settings.page').then(module => module.SettingsPage) },
  { path: 'journal', loadComponent: () => import('./journal/journal.page').then(module => module.JournalPage) },
  { path: 'intro', loadComponent: () => import('./intro/intro.page').then(module => module.IntroPage) },
  { path: 'textbook', loadComponent: () => import('./textbook/textbook.page').then(module => module.TextbookPage) },
  { path: '**', redirectTo: '' },
];
