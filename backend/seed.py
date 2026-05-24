"""Seed script: creates dummy users, books, series for testing."""

import hashlib
import sys
import os
from datetime import datetime, timedelta
from random import choice, randint

sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, init_db, User, Book, Series, BookVersion, book_series_association
from auth import pwd_context

AUTHOR_NAMES = [
    "Александр Пушкин", "Лев Николаевич Толстой — величайший русский писатель и мыслитель", "Фёдор Достоевский", "Иван Тургенев",
    "Антон Чехов", "Николай Гоголь", "Михаил Лермонтов", "Иван Бунин",
    "Александр Блок", "Сергей Есенин", "Владимир Маяковский", "Марина Цветаева",
    "Анна Ахматова", "Борис Пастернак", "Михаил Булгаков", "Александр Солженицын",
    "Василий Шукшин", "Виктор Пелевин", "Борис Акунин", "Евгений Замятин",
    "Илья Ильф", "Евгений Петров", "Аркадий Стругацкий", "Борис Стругацкий",
    "Владимир Набоков", "Александр Куприн", "Николай Некрасов", "Афанасий Фет",
    "Фёдор Тютчев", "Иван Крылов", "Александр Грибоедов", "Денис Фонвизин",
    "Николай Карамзин", "Михаил Салтыков-Щедрин", "Иван Гончаров", "Александр Островский",
    "Леонид Андреев", "Александр Беляев", "Вениамин Каверин", "Константин Паустовский",
    "Юрий Олеша", "Илья Эренбург", "Валентин Катаев", "Лев Кассиль",
    "Аркадий Гайдар", "Самуил Маршак",
    "Владимир Гиляровский", "Александр Грин", "Михаил Зощенко", "Даниил Хармс",
]

SERIES_NAMES = [
    "Русская классика", "Современная проза", "Фантастика и фэнтези",
    "Детективы и триллеры", "Поэзия Серебряного века", "Исторические романы",
    "Научная фантастика", "Приключения", "Драматургия", "Рассказы и повести",
    "Эпические саги", "Любовные романы",
    "Готическая проза", "Сатира и юмор", "Антиутопии и дистопии",
    "Приключения в космосе", "Психологический роман", "Эссе и публицистика",
    "Магический реализм", "Киберпанк", "Героическое фэнтези",
    "Мистика и ужасы", "Автобиографии", "Повести о войне",
    "Романы воспитания", "Философская проза",
]

READER_NAMES = [
    "Иван Петров", "Елена Соколова", "Дмитрий Кузнецов", "Ольга Попова",
    "Сергей Васильев", "Анна Новикова", "Алексей Морозов", "Татьяна Волкова",
    "Максим Зайцев", "Наталья Крылова", "Артём Белов", "Юлия Орлова",
    "Павел Козлов", "Мария Лебедева", "Андрей Семёнов", "Светлана Фёдорова",
    "Николай Григорьев", "Кристина Павлова", "Владислав Степанов", "Алиса Николаева",
    "Роман Тихонов", "Вероника Михайлова", "Егор Захаров", "Полина Медведева",
    "Константин Яковлев", "Валерия Макарова", "Григорий Егоров", "Людмила Виноградова",
    "Тимур Осипов", "Лариса Кузьмина",
]

BOOK_TITLES = [
    "Евгений Онегин", "Война и мир", "Преступление и наказание", "Отцы и дети",
    "Вишнёвый сад", "Мёртвые души", "Герой нашего времени", "Тёмные аллеи",
    "Двенадцать", "Чёрный человек", "Облако в штанах", "На заре туманной юности",
    "Реквием", "Доктор Живаго", "Мастер и Маргарита", "Архипелаг ГУЛАГ",
    "Калина красная", "Generation П", "Азазель", "Мы",
    "Анна Каренина", "Идиот", "Записки из подполья", "Дворянское гнездо",
    "Чайка", "Тарас Бульба", "Демон", "Митина любовь",
    "Стихи о Прекрасной Даме", "Исповедь хулигана", "Флейта-позвоночник", "Версты",
    "Поэма без героя", "Спекторский", "Собачье сердце", "Один день Ивана Денисовича",
    "Земляки", "Чапаев и Пустота", "Турецкий гамбит", "Бич Божий",
    "Воскресение", "Бесы", "Вешние воды", "Три сестры",
    "Ревизор", "Вадим", "Жизнь Арсеньева", "Возмездие",
    "Анна Снегина", "Про это", "Лебединый стан", "Рождение человека",
    "Белая гвардия", "Раковый корпус", "Я пришёл дать вам волю", "Empire V",
    "Статский советник", "Русь", "Война и мир (Том 2)", "Война и мир (Том 3)",
    "Подросток", "Братья Карамазовы", "Муму", "Записки охотника",
    "Дядя Ваня", "Шинель", "Мцыри", "Господин из Сан-Франциско",
    "Скифы", "Пугачёв", "Клоп", "Крысолов",
    "Волоколамское шоссе", "Колымские рассказы", "Уроки французского", "Омон Ра",
    "Смерть на брудершафт", "Мать", "Хождение по мукам",
    "Пётр Первый", "Тихий Дон", "Поднятая целина", "Молодая гвардия",
    "Золотой телёнок", "Двенадцать стульев", "Собачье сердце",
]

GENRES = [
    "классика,роман", "классика,поэзия", "фантастика,роман",
    "детектив,триллер", "поэзия,лирика", "история,роман",
    "фантастика,научная", "приключения,роман", "драма,пьеса",
    "рассказы,проза", "эпос,роман", "любовный роман",
]


def seed():
    init_db()
    db = SessionLocal()

    existing = db.query(User).count()
    if existing > 5:
        print(f"DB already has {existing} users, skipping seed (run with --force to override)")
        db.close()
        return

    print("Seeding database...")

    # 0. Create admin user
    admin = User(
        username="admin",
        hashed_password=pwd_context.hash("admin"),
        role="admin",
        is_plus=True,
        created_at=datetime.utcnow() - timedelta(days=365),
    )
    db.add(admin)
    db.flush()
    print(f"  Created admin user (admin/admin)")

    # 1. Create authors
    authors = []
    for i, name in enumerate(AUTHOR_NAMES):
        u = User(
            username=name,
            hashed_password=pwd_context.hash("test123"),
            role="user",
            is_plus=(i < 5),
            created_at=datetime.utcnow() - timedelta(days=randint(30, 365)),
        )
        db.add(u)
        db.flush()
        authors.append(u)
    print(f"  Created {len(authors)} authors")

    # 1b. Create regular readers (no books)
    readers = []
    for name in READER_NAMES:
        u = User(
            username=name,
            hashed_password=pwd_context.hash("test123"),
            role="user",
            is_plus=False,
            created_at=datetime.utcnow() - timedelta(days=randint(1, 60)),
        )
        db.add(u)
        db.flush()
        readers.append(u)
    print(f"  Created {len(readers)} readers")

    # 2. Create series (assigned to random authors)
    all_series = []
    for name in SERIES_NAMES:
        owner = choice(authors)
        s = Series(
            name=name,
            owner_id=owner.id,
            common_genres=choice(GENRES),
        )
        db.add(s)
        db.flush()
        all_series.append(s)
    print(f"  Created {len(all_series)} series")

    # 3. Create books — ensure every author has at least 1
    all_books = []
    fake_content = b"This is a placeholder book content for testing purposes. " * 100
    fake_sha = hashlib.sha256(fake_content).hexdigest()

    titles_remaining = list(BOOK_TITLES)
    # First pass: one book per author
    for author in authors:
        title = titles_remaining.pop(0)
        idx = len(all_books)
        b = Book(
            title=title,
            filename=f"{title.lower().replace(' ', '_')}.txt",
            sha256=f"{fake_sha[:32]}{idx:08x}",
            file_path=f"/tmp/fake_books/{idx}.txt",
            is_public=True,
            owner_id=author.id,
            created_at=datetime.utcnow() - timedelta(days=randint(0, 180)),
            genres=choice(GENRES),
            description=f"Тестовое описание книги «{title}» — просто placeholder для проверки интерфейса.",
            cover_image=None,
            view_count=randint(0, 5000),
            like_count=randint(0, 200),
            subscription_count=randint(0, 50),
            popularity_score=randint(0, 10000),
        )
        db.add(b)
        db.flush()

        v = BookVersion(
            book_id=b.id,
            format="epub",
            file_path=f"/tmp/fake_books/{idx}.epub",
            sha256=f"{fake_sha[:32]}{idx:08x}",
            filename=f"{title.lower().replace(' ', '_')}.epub",
        )
        db.add(v)

        s = choice(all_series)
        existing = db.execute(
            book_series_association.select().where(
                book_series_association.c.book_id == b.id,
                book_series_association.c.series_id == s.id,
            )
        ).first()
        if not existing:
            db.execute(book_series_association.insert().values(book_id=b.id, series_id=s.id))

        all_books.append(b)

    # Second pass: remaining books to random authors
    for title in titles_remaining:
        idx = len(all_books)
        author = choice(authors)
        b = Book(
            title=title,
            filename=f"{title.lower().replace(' ', '_')}.txt",
            sha256=f"{fake_sha[:32]}{idx:08x}",
            file_path=f"/tmp/fake_books/{idx}.txt",
            is_public=True,
            owner_id=author.id,
            created_at=datetime.utcnow() - timedelta(days=randint(0, 180)),
            genres=choice(GENRES),
            description=f"Тестовое описание книги «{title}» — просто placeholder для проверки интерфейса.",
            cover_image=None,
            view_count=randint(0, 5000),
            like_count=randint(0, 200),
            subscription_count=randint(0, 50),
            popularity_score=randint(0, 10000),
        )
        db.add(b)
        db.flush()

        v = BookVersion(
            book_id=b.id,
            format="epub",
            file_path=f"/tmp/fake_books/{idx}.epub",
            sha256=f"{fake_sha[:32]}{idx:08x}",
            filename=f"{title.lower().replace(' ', '_')}.epub",
        )
        db.add(v)

        # Assign to 1 random series (avoid duplicates)
        s = choice(all_series)
        existing = db.execute(
            book_series_association.select().where(
                book_series_association.c.book_id == b.id,
                book_series_association.c.series_id == s.id,
            )
        ).first()
        if not existing:
            db.execute(book_series_association.insert().values(
                book_id=b.id, series_id=s.id, order_index=randint(0, 10)
            ))

        all_books.append(b)
        db.commit()

    db.commit()
    db.close()
    print(f"  Created {len(all_books)} books")
    print("Seeding complete!")


if __name__ == "__main__":
    if "--force" in sys.argv:
        from database import Base, engine
        Base.metadata.drop_all(bind=engine)
        print("Dropped all tables, recreating...")
    seed()
