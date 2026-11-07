import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./home/home.page').then(module => module.HomePage) },
  { path: 'course', loadComponent: () => import('./course/course-trail.page').then(module => module.CourseTrailPage) },
  { path: 'course/:exerciseId', loadComponent: () => import('./course/exercise-sheet.page').then(module => module.ExerciseSheetPage) },
  { path: 'settings', loadComponent: () => import('./settings/settings.page').then(module => module.SettingsPage) },
  { path: 'journal', loadComponent: () => import('./log/log.page').then(module => module.LogPage) },
  { path: 'journal/:shotId', loadComponent: () => import('./debrief/debrief.page').then(module => module.DebriefPage) },
  { path: 'weather', loadComponent: () => import('./weather/weather.page').then(module => module.WeatherPage) },
  { path: 'calc', loadComponent: () => import('./calc/calc.page').then(module => module.CalcPage) },
  { path: 'calc/wind', loadComponent: () => import('./wind/wind.page').then(module => module.WindPage) },
  { path: 'dope', loadComponent: () => import('./dope/dope.page').then(module => module.DopePage) },
  { path: 'scope', loadComponent: () => import('./scope/scope.page').then(module => module.ScopePage) },
  { path: '**', redirectTo: '' },
];
