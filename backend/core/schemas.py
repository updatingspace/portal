from datetime import datetime

from ninja import Schema


class HomePageModalOut(Schema):
    """Schema for homepage modal output"""

    id: int
    title: str
    content: str
    button_text: str
    button_url: str
    modal_type: str
    display_once: bool
    start_date: datetime | None
    end_date: datetime | None
    order: int


class HomePageModalIn(Schema):
    """Schema for homepage modal input (admin creation/update)"""

    title: str
    content: str
    button_text: str = "OK"
    button_url: str = ""
    modal_type: str = "info"
    is_active: bool = True
    display_once: bool = False
    start_date: datetime | None = None
    end_date: datetime | None = None
    order: int = 0
