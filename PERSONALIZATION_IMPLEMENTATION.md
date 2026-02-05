# Персонализация — Модальные окна на главной странице

## Обзор функции

Реализована полная система управления модальными окнами на главной странице через админку. Все компоненты используют Gravity UI.

## Компоненты Gravity UI

### Администраторская панель
- ✅ Table — список модалок
- ✅ Button — кнопки действий
- ✅ TextInput — поля ввода
- ✅ TextArea — содержание
- ✅ Select — выбор типа
- ✅ Checkbox — флаги
- ✅ Modal — диалоги
- ✅ Card — карточки
- ✅ Loader — загрузка

### Главная страница
- ✅ Modal — отображение модалок
- ✅ Button — кнопки действий

## Отклонения от Gravity UI

**Единственное отклонение: datetime-local input**
- Использован нативный HTML5 `<input type="datetime-local">`
- Причина: Gravity UI не имеет компонента для одновременного выбора даты и времени
- Альтернатива: Отдельные DatePicker и TimePicker снизили бы UX
- Влияние: Минимальное, стилизация соответствует форме

## Архитектура

### Backend
- Django модель `HomePageModal`
- API endpoints через Django Ninja
- Superuser authentication
- Proper error handling с HttpError

### Frontend
- PersonalizationSection — админка
- HomePageModalEditor — редактор
- HomePageModalDisplay — показ на главной
- Local storage для отслеживания показов

## Безопасность

✅ XSS Protection — plain text рендеринг
✅ Authentication — superuser only
✅ Authorization — проверка прав
✅ CodeQL — 0 уязвимостей
✅ Input validation — Django + Ninja схемы

## Качество кода

✅ TypeScript typecheck
✅ ESLint
✅ Build success
✅ Code review (3 issue fixed)
✅ Security scan pass

## Использование

1. Админка: `/admin?section=personalization`
2. Создание модалки через UI
3. Настройка дат и порядка
4. Автоматический показ на главной
