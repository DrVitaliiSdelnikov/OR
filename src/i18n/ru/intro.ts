import { decimal } from '../format';

export const intro = {
  steps: {
    rifle: {
      title: 'Винтовка',
      instruction: 'Это винтовка. Тапни по каждой части — узнаешь, зачем она',
      parts: {
        barrel: { name: 'Ствол', caption: 'Разгоняет пулю и задаёт ей направление. Холодный ствол бьёт чуть иначе, чем прогретый' },
        bolt: { name: 'Затвор', caption: 'Запирает патрон в стволе. После выстрела — вверх, назад, вперёд, вниз: гильза вылетает, новый патрон в стволе' },
        magazine: { name: 'Магазин', caption: 'Пять патронов. Пуст — меняешь магазин' },
        trigger: { name: 'Спуск', caption: 'Дави плавно до выстрела. Рывок уводит пулю' },
        scope: { name: 'Прицел', caption: 'Приближает цель и показывает, куда смотрит ствол, с поправкой барабанами' },
      },
    },
    scope: {
      title: 'Прицел',
      instruction: 'Прицел в разрезе. Тапни по каждой части',
      parts: {
        objective: { name: 'Объектив', caption: 'Большое стекло спереди: собирает свет от цели' },
        eyepiece: { name: 'Окуляр', caption: 'Стекло у глаза: в нём ты видишь цель и сетку' },
        elevation: { name: 'Барабан ВЕРТ', caption: 'Поднимает и опускает точку попадания: один клик — 0,1 MIL' },
        windage: { name: 'Барабан ГОР', caption: 'Сдвигает точку попадания влево и вправо — поправка на ветер' },
        zoom: {
          name: 'Кольцо',
          caption: (p: { magnificationMin: number; magnificationMax: number }) => `Кольцо кратности: приближение от ${p.magnificationMin}× до ${p.magnificationMax}×`,
        },
      },
    },
    drum: {
      title: 'Барабан',
      instruction: (p: { clicks: number }) => `Накрути барабан ВЕРТ вверх на ${p.clicks} кликов — смотри, куда уходит точка попадания`,
    },
    zoom: { title: 'Кратность', instruction: 'Покрути кратность вверх и вниз — гонг и метки сетки растут вместе' },
    reticles: {
      title: 'Сетки',
      instruction: (p: { gongSizeM: number; distanceM: number }) =>
        `Тапни по меткам сеток. Потом ответь: гонг ${decimal(p.gongSizeM)} м на ${p.distanceM} м — сколько MIL он займёт?`,
    },
    cartridges: { title: 'Патроны', instruction: 'Три патрона: тяжелее и обтекаемее — меньше падает и меньше сносится ветром' },
    bolt: { title: 'Затвор', instruction: 'Передёрни затвор: тяни рукоять вверх, назад, вперёд, вниз' },
  },
  measureHint: 'Не так. Д = размер × 1000 / mil — отсюда mil = размер × 1000 / Д',
  page: {
    back: 'Назад',
    title: (p: { exerciseId: string; exerciseTitle: string }) => `${p.exerciseId} · ${p.exerciseTitle}`,
    stepCounter: (p: { number: number; count: number; title: string }) => `шаг ${p.number} из ${p.count} · ${p.title}`,
    callsign: 'Старший:',
    question: (p: { gongSizeM: number; distanceM: number }) => `Гонг ${decimal(p.gongSizeM)} м на ${p.distanceM} м — сколько MIL?`,
    answer: (p: { mil: number }) => `${decimal(p.mil)} MIL`,
    pendingCartridges: 'считаю карточки патронов…',
    boltDone: 'Патрон в стволе — затвор закрыт',
    zoomOut: 'Уменьшить кратность',
    zoomIn: 'Увеличить кратность',
    finish: (p: { exerciseId: string }) => `Готов к упражнению ${p.exerciseId}`,
    next: 'Дальше',
    drumCounter: (p: { clicks: number }) => `${p.clicks} кл.`,
  },
  partScheme: {
    rifleLabel: 'Винтовка сбоку',
    scopeLabel: 'Прицел в разрезе',
    tapHint: 'Тапни по части',
  },
};
