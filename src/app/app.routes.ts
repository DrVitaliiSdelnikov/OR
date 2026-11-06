import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tabs/hub' },
  {
    path: 'tabs',
    loadComponent: () => import('./tabs/tabs.page').then(module => module.TabsPage),
    children: [
      { path: 'hub', loadComponent: () => import('./hub/hub.page').then(module => module.HubPage) },
      { path: 'hub/weather', loadComponent: () => import('./weather/weather.page').then(module => module.WeatherPage) },
      { path: 'hub/settings', loadComponent: () => import('./settings/settings.page').then(module => module.SettingsPage) },
      { path: 'hub/tasks/:taskId', loadComponent: () => import('./quiz/quiz.page').then(module => module.QuizPage) },
      { path: 'calc', loadComponent: () => import('./calc/calc.page').then(module => module.CalcPage) },
      { path: 'calc/wind', loadComponent: () => import('./wind/wind.page').then(module => module.WindPage) },
      { path: 'dope', loadComponent: () => import('./dope/dope.page').then(module => module.DopePage) },
      { path: 'log', loadComponent: () => import('./log/log.page').then(module => module.LogPage) },
      { path: 'log/:shotId', loadComponent: () => import('./debrief/debrief.page').then(module => module.DebriefPage) },
      { path: '', pathMatch: 'full', redirectTo: 'hub' },
    ],
  },
  { path: 'scope', loadComponent: () => import('./scope/scope.page').then(module => module.ScopePage) },
  { path: '**', redirectTo: 'tabs/hub' },
];
