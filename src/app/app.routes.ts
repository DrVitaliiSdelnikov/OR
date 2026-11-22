import type { PositionPage } from './position/position.page';
import type { RifleEditPage } from './rifle/rifle-edit.page';
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./home/home.page').then(module => module.HomePage) },
  { path: 'course', loadComponent: () => import('./course/course-trail.page').then(module => module.CourseTrailPage) },
  { path: 'course/:exerciseId', loadComponent: () => import('./course/exercise-sheet.page').then(module => module.ExerciseSheetPage) },
  { path: 'position/00', redirectTo: 'intro' },
  { path: 'position/:exerciseId', loadComponent: () => import('./position/position.page').then(module => module.PositionPage), canDeactivate: [(page: PositionPage) => page.canLeave()] },
  { path: 'drills', loadComponent: () => import('./drill/drill-list.page').then(module => module.DrillListPage) },
  { path: 'drill/:drillId', loadComponent: () => import('./drill/drill-round.page').then(module => module.DrillRoundPage) },
  { path: 'free', loadComponent: () => import('./free/free-play.page').then(module => module.FreePlayPage) },
  { path: 'settings', loadComponent: () => import('./settings/settings.page').then(module => module.SettingsPage) },
  { path: 'daily', loadComponent: () => import('./daily/daily.page').then(module => module.DailyPage) },
  { path: 'progress', loadComponent: () => import('./progress/progress.page').then(module => module.ProgressPage) },
  { path: 'journal', loadComponent: () => import('./journal/journal.page').then(module => module.JournalPage) },
  { path: 'intro', loadComponent: () => import('./intro/intro.page').then(module => module.IntroPage) },
  { path: 'rifle', loadComponent: () => import('./rifle/rifle.page').then(module => module.RiflePage) },
  {
    path: 'rifle/new/:presetCode',
    loadComponent: () => import('./rifle/rifle-edit.page').then(module => module.RifleEditPage),
    canDeactivate: [(page: RifleEditPage) => page.canLeave()],
  },
  { path: 'rifle/:profileId/dope', loadComponent: () => import('./rifle/rifle-dope.page').then(module => module.RifleDopePage) },
  {
    path: 'rifle/:profileId',
    loadComponent: () => import('./rifle/rifle-edit.page').then(module => module.RifleEditPage),
    canDeactivate: [(page: RifleEditPage) => page.canLeave()],
  },
  { path: 'textbook', loadComponent: () => import('./textbook/textbook.page').then(module => module.TextbookPage) },
  { path: 'model', loadComponent: () => import('./model/model.page').then(module => module.ModelPage) },
  { path: 'about', loadComponent: () => import('./about/about.page').then(module => module.AboutPage) },
  { path: '**', redirectTo: '' },
];
