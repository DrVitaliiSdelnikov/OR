import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./home/home.page').then(module => module.HomePage) },
  { path: 'course', loadComponent: () => import('./course/course-trail.page').then(module => module.CourseTrailPage) },
  { path: 'course/:exerciseId', loadComponent: () => import('./course/exercise-sheet.page').then(module => module.ExerciseSheetPage) },
  { path: 'position/:exerciseId', loadComponent: () => import('./position/position.page').then(module => module.PositionPage) },
  { path: 'settings', loadComponent: () => import('./settings/settings.page').then(module => module.SettingsPage) },
  { path: 'journal', loadComponent: () => import('./log/log.page').then(module => module.LogPage) },
  { path: '**', redirectTo: '' },
];
