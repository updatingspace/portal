from django.db import models


class HomePageModal(models.Model):
    class ModalType(models.TextChoices):
        INFO = "info", "Информация"
        WARNING = "warning", "Предупреждение"
        SUCCESS = "success", "Успех"
        PROMO = "promo", "Промо"

    title = models.CharField("Заголовок", max_length=255)
    content = models.TextField("Содержание")
    button_text = models.CharField("Текст кнопки", max_length=100, default="OK")
    button_url = models.CharField("Ссылка кнопки", max_length=500, blank=True)
    modal_type = models.CharField(
        "Тип модалки",
        max_length=50,
        choices=ModalType.choices,
        default=ModalType.INFO,
    )
    is_active = models.BooleanField("Активна", default=True)
    display_once = models.BooleanField("Показать один раз", default=False)
    start_date = models.DateTimeField("Дата начала показа", null=True, blank=True)
    end_date = models.DateTimeField("Дата окончания показа", null=True, blank=True)
    order = models.IntegerField("Порядок показа", default=0)
    created_at = models.DateTimeField("Создана", auto_now_add=True)
    updated_at = models.DateTimeField("Обновлена", auto_now=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = "Модальное окно главной страницы"
        verbose_name_plural = "Модальные окна главной страницы"
