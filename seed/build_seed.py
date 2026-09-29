# Builds seed/menu.json.
# Rule: only dishes that have a photo. Food: name + description from the PDF menu,
# price from БОБОЙ.xlsx. Drinks (not in the PDF): name + price from БОБОЙ.xlsx, no description.
# `excel` holds the exact Excel row name so prices can be re-checked automatically.
import json

L = lambda uz, uzc, ru, en: {"uz": uz, "uzc": uzc, "ru": ru, "en": en}

categories = [
    ("shashlik", L("Shashliklar", "Шашликлар", "Шашлыки", "Kebabs")),
    ("lemonade", L("Limonadlar", "Лимонадлар", "Лимонады", "Lemonades")),
    ("mojito", L("Mojito", "Мохито", "Мохито", "Mojito")),
    ("icetea", L("Ays ti", "Айс ти", "Айс ти", "Iced tea")),
    ("compote", L("Kompot va ayron", "Компот ва айрон", "Компоты и айран", "Compote & ayran")),
    ("milkshake", L("Milksheyklar", "Милкшейклар", "Милкшейки", "Milkshakes")),
    ("smoothie", L("Smuzi", "Смузи", "Смузи", "Smoothies")),
    ("juice", L("Fresh sharbatlar", "Фреш шарбатлар", "Свежие соки", "Fresh juices")),
    ("coffee", L("Qahva", "Қаҳва", "Кофе", "Coffee")),
    ("latte", L("Qahvasiz latte", "Қаҳвасиз латте", "Не кофе", "Non-coffee lattes")),
    ("icedcoffee", L("Sovuq qahva", "Совуқ қаҳва", "Холодный кофе", "Iced coffee")),
]

# (category, photo, excel_name, names, description or None, price, double_price or None)
items = [
    # ---- Шашлыки (PDF pp.15-16) ----
    ("shashlik", "s_9c104c9b", ["БАРАНИНА \"СЕМЕЧКИ\""],
     L("Qo'y go'shti «Semechki»", "Қўй гўшти «Семечки»", "Баранина «Семечки»", "Lamb “Semechki” kebab"),
     L("Xushbo'y ziravorlar bilan qizarguncha pishirilgan yumshoq qo'y go'shti — to'yimli go'sht ta'mi.",
       "Хушбўй зираворлар билан қизаргунча пиширилган юмшоқ қўй гўшти — тўйимли гўшт таъми.",
       "Нежная баранина, обжаренная до румяной корочки, с ароматными специями - насыщенный мясной вкус.",
       "Tender lamb grilled to a golden crust with aromatic spices — a rich, meaty flavour."), 65000, None),
    ("shashlik", "s_5e2a6d23", ["БАРАНИНА КУСКОВОЙ"],
     L("Qo'y go'shti (bo'lakli)", "Қўй гўшти (бўлакли)", "Баранина кусковой", "Lamb chunk kebab"),
     L("Katta bo'laklarga to'g'ralgan va xushbo'y ziravorlar bilan qizarguncha pishirilgan yumshoq qo'y go'shti.",
       "Катта бўлакларга тўғралган ва хушбўй зираворлар билан қизаргунча пиширилган юмшоқ қўй гўшти.",
       "Нежная баранина, нарезанная крупными кусочками и обжаренная до румяной корочки с ароматными специями.",
       "Tender lamb cut into large pieces and grilled to a golden crust with aromatic spices."), 63000, None),
    ("shashlik", "s_6333c321", ["ГОВЯДИНА КУСКОВОЙ"],
     L("Mol go'shti (bo'lakli)", "Мол гўшти (бўлакли)", "Говядина кусковой", "Beef chunk kebab"),
     L("Bo'laklarga to'g'ralgan va xushbo'y ziravorlar bilan qizarguncha pishirilgan yumshoq mol go'shti.",
       "Бўлакларга тўғралган ва хушбўй зираворлар билан қизаргунча пиширилган юмшоқ мол гўшти.",
       "Нежная говядина, нарезанная кусочками и обжаренная до румяной корочки с ароматными специями.",
       "Tender beef cut into pieces and grilled to a golden crust with aromatic spices."), 59000, None),
    ("shashlik", "s_2ba24f67", ["КОРЕЙКА ИЗ ЯГНЕНКА"],
     L("Qo'zichoq qovurg'asi", "Қўзичоқ қовурғаси", "Корейка из ягненка", "Lamb rack"),
     L("Xushbo'y ziravorlar bilan qizarguncha pishirilgan yumshoq qo'zichoq go'shti.",
       "Хушбўй зираворлар билан қизаргунча пиширилган юмшоқ қўзичоқ гўшти.",
       "Нежная ягнятина с ароматными специями, приготовленная до румяной корочки.",
       "Tender lamb with aromatic spices, grilled to a golden crust."), 159000, None),
    ("shashlik", "s_bdc5fb15", ["МОЛОТЫЙ ТАШКЕНТ", "МОЛОТЫЙ ГИЖДУВОН"],
     L("Qiyma kabob", "Қийма кабоб", "Молотый", "Minced meat kebab"),
     L("Piyoz va ziravorlar qo'shilgan, qizarguncha pishirilgan shirali qiyma go'sht.",
       "Пиёз ва зираворлар қўшилган, қизаргунча пиширилган ширали қийма гўшт.",
       "Сочное рубленое мясо с луком и специями, приготовленное до румяной корочки.",
       "Juicy minced meat with onion and spices, grilled to a golden crust."), 51000, None),
    ("shashlik", "s_a6072507", ["РУЛЕТ ШАШЛЫК"],
     L("Rulet shashlik", "Рулет шашлик", "Рулет шашлык", "Rolled kebab"),
     L("Grilda qizarguncha pishirilgan shirali go'sht — g'ayrioddiy ko'rinishdagi xushbo'y shashlik.",
       "Грилда қизаргунча пиширилган ширали гўшт — ғайриоддий кўринишдаги хушбўй шашлик.",
       "Сочное мясо, приготовленное на гриле до румяной корочки - ароматный шашлык в необычной подаче.",
       "Juicy meat grilled to a golden crust — a fragrant kebab with an unusual presentation."), 65000, None),
    ("shashlik", "s_a38d47d2", ["КУРИНЫЕ БЕДРА"],
     L("Tovuq sonlari", "Товуқ сонлари", "Куриные бедра", "Chicken thigh kebab"),
     L("Xushbo'y ziravorlar bilan pishirilgan, qizarib turgan shirali tovuq sonlari.",
       "Хушбўй зираворлар билан пиширилган, қизариб турган ширали товуқ сонлари.",
       "Сочные куриные бёдра с румяной корочкой, приготовленные с ароматными специями.",
       "Juicy chicken thighs with a golden crust, cooked with aromatic spices."), 47000, None),
    ("shashlik", "s_437a5686", ["КУРИНЫЕ КРЫЛЫШКИ"],
     L("Tovuq qanotchalari", "Товуқ қанотчалари", "Куриные крылышки", "Chicken wings"),
     L("Xushbo'y ziravorlar bilan pishirilgan, qizarib turgan shirali tovuq qanotchalari.",
       "Хушбўй зираворлар билан пиширилган, қизариб турган ширали товуқ қанотчалари.",
       "Сочные куриные крылышки с румяной корочкой, приготовленные с ароматными специями.",
       "Juicy chicken wings with a golden crust, cooked with aromatic spices."), 49000, None),
    ("shashlik", "s_db1a98ec", ["ПЕЧЕНЬ"],
     L("Jigar", "Жигар", "Печень", "Liver kebab"),
     L("Piyoz va ziravorlar bilan qizarguncha pishirilgan yumshoq jigar.",
       "Пиёз ва зираворлар билан қизаргунча пиширилган юмшоқ жигар.",
       "Нежная печень, обжаренная с луком и специями до румяной корочки.",
       "Tender liver grilled with onion and spices to a golden crust."), 45000, None),

    # ---- Лимонады ----
    ("lemonade", "00686", ["КЛАССИК ЛИМОНАД"], L("Klassik limonad", "Классик лимонад", "Классический лимонад", "Classic lemonade"), None, 55000, None),
    ("lemonade", "00689", ["МАРАКУЙЯ МАНГО ЛИМОНАД"], L("Marakuyya-mango limonadi", "Маракуйя-манго лимонади", "Лимонад маракуйя-манго", "Passion fruit & mango lemonade"), None, 73000, None),
    ("lemonade", "00679", ["ЛИМОНАД КЛУБНИКА ЛИЧИ "], L("Qulupnay-lichi limonadi", "Қулупнай-личи лимонади", "Лимонад клубника-личи", "Strawberry & lychee lemonade"), None, 73000, None),
    ("lemonade", "00688", ["КЛУБНИКА С АНАНАСОМ ЛИМОНАД"], L("Qulupnay va ananasli limonad", "Қулупнай ва ананасли лимонад", "Лимонад клубника с ананасом", "Strawberry & pineapple lemonade"), None, 59000, None),
    # ---- Мохито ----
    ("mojito", "00701", ["КЛАССИЧЕСКИЙ МОХИТО"], L("Klassik mojito", "Классик мохито", "Классический мохито", "Classic mojito"), None, 57000, None),
    ("mojito", "00700", ["КЛУБНИЧНЫЙ МОХИТО"], L("Qulupnayli mojito", "Қулупнайли мохито", "Клубничный мохито", "Strawberry mojito"), None, 57000, None),
    ("mojito", "00699", ["МАРАКУЯ МОХИТО"], L("Marakuyya mojito", "Маракуйя мохито", "Мохито маракуйя", "Passion fruit mojito"), None, 73000, None),
    ("mojito", "00702", ["RED BULL МОХИТО"], L("Red Bull mojito", "Red Bull мохито", "Red Bull мохито", "Red Bull mojito"), None, 73000, None),
    # ---- Айс ти ----
    ("icetea", "00684", ["ГИБИСКУС С ВИШНЕЙ АЙС ТИ"], L("Gibiskus va olchali ays ti", "Гибискус ва олчали айс ти", "Айс ти гибискус с вишней", "Hibiscus & cherry iced tea"), None, 65000, None),
    ("icetea", "00682", ["ФРУКТОВЫЙ АЙС ТИ"], L("Mevali ays ti", "Мевали айс ти", "Фруктовый айс ти", "Fruit iced tea"), None, 65000, None),
    # ---- Компоты и айран ----
    ("compote", "00681", ["АЙРАН"], L("Ayron", "Айрон", "Айран", "Ayran"), None, 43000, None),
    ("compote", "00690", ["МИКС КОМПОТ"], L("Aralash kompot", "Аралаш компот", "Микс компот", "Mixed fruit compote"), None, 43000, None),
    ("compote", "00691", ["КУРАГА КОМПОТ"], L("O'rik qoqi kompoti", "Ўрик қоқи компоти", "Компот из кураги", "Dried apricot compote"), None, 43000, None),
    # ---- Милкшейки ----
    ("milkshake", "00703", ["КЛУБНИЧНЫЙ МИЛКШЕЙК"], L("Qulupnayli milksheyk", "Қулупнайли милкшейк", "Клубничный милкшейк", "Strawberry milkshake"), None, 70000, None),
    ("milkshake", "00704", ["БУЕНО С АРАХИСОМ"], L("Yeryong'oqli Bueno", "Ерёнғоқли Буено", "Буено с арахисом", "Bueno peanut shake"), None, 65000, None),
    ("milkshake", "00705", ["КЛАССИЧЕСКИЙ МИЛКШЕЙК"], L("Klassik milksheyk", "Классик милкшейк", "Классический милкшейк", "Classic milkshake"), None, 57000, None),
    ("milkshake", "00707", ["ТОФФИ КАРАМЕЛЬ МИЛКШЕЙК"], L("Toffi-karamel milksheyk", "Тоффи-карамел милкшейк", "Милкшейк тоффи-карамель", "Toffee caramel milkshake"), None, 70000, None),
    # ---- Смузи ----
    ("smoothie", "00719", ["СМУЗИ МАНГО МАРАКУЙЯ"], L("Mango-marakuyya smuzi", "Манго-маракуйя смузи", "Смузи манго-маракуйя", "Mango & passion fruit smoothie"), None, 59000, None),
    ("smoothie", "00717", ["СМУЗИ КЛУБНИКА МАЛИНА"], L("Qulupnay-malina smuzi", "Қулупнай-малина смузи", "Смузи клубника-малина", "Strawberry & raspberry smoothie"), None, 47000, None),
    ("smoothie", "00718", ["ЯГОДНЫЙ СМУЗИ"], L("Rezavorli smuzi", "Резаворли смузи", "Ягодный смузи", "Berry smoothie"), None, 53000, None),
    # ---- Свежие соки ----
    ("juice", "00759", ["АПЕЛЬСИНОВЫЙ ФРЕШ"], L("Apelsin fresh", "Апелсин фреш", "Апельсиновый фреш", "Fresh orange juice"), None, 92000, None),
    ("juice", "00757", ["ЯБЛОЧНЫЙ ФРЕШ"], L("Olma fresh", "Олма фреш", "Яблочный фреш", "Fresh apple juice"), None, 47000, None),
    ("juice", "00762", ["МОРКОВНЫЙ ФРЕШ"], L("Sabzi fresh", "Сабзи фреш", "Морковный фреш", "Fresh carrot juice"), None, 35000, None),
    ("juice", "00763", ["ЯБЛОЧНО-МОРКОВНЫЙ ФРЕШ"], L("Olma-sabzi fresh", "Олма-сабзи фреш", "Яблочно-морковный фреш", "Fresh apple & carrot juice"), None, 43000, None),
    ("juice", "00758", ["ЯБЛОКО АПЕЛЬСИН МОРКОВЬ"], L("Olma, apelsin, sabzi", "Олма, апелсин, сабзи", "Яблоко, апельсин, морковь", "Apple, orange & carrot juice"), None, 49000, None),
    # ---- Кофе (сингл / дабл) ----
    ("coffee", "00708", ["КАПУЧИНО СИНГЛЕ", "КАПУЧИНО ДАББЛ"], L("Kapuchino", "Капучино", "Капучино", "Cappuccino"), None, 35000, 47000),
    ("coffee", "00709", ["ЛАТТЕ СИНГЛЕ", "ЛАТТЕ ДАББЛ"], L("Latte", "Латте", "Латте", "Latte"), None, 35000, 47000),
    ("coffee", "00712", ["АМЕРИКАНО СИНГЛЕ", "АМЕРИКАНО ДАББЛ"], L("Amerikano", "Американо", "Американо", "Americano"), None, 33000, 39000),
    ("coffee", "00710", ["ЭСПРЕССО СИНГЛЕ", "ЭСПРЕССО ДАББЛ"], L("Espresso", "Эспрессо", "Эспрессо", "Espresso"), None, 29000, 35000),
    ("coffee", "00724", ["РАФ"], L("Raf", "Раф", "Раф", "Raf coffee"), None, 55000, None),
    # ---- Не кофе ----
    ("latte", "00742", ["МАТЧА ЛАТТЕ СИНГЛЕ", "МАТЧА ЛАТТЕ ДАББЛ"], L("Matcha latte", "Матча латте", "Матча латте", "Matcha latte"), None, 37000, 49000),
    ("latte", "00743", ["РОЗОВЫЙ ЛАТТЕ СИНГЛЕ", "РОЗОВЫЙ ЛАТТЕ ДАББЛ"], L("Pushti latte", "Пушти латте", "Розовый латте", "Pink latte"), None, 42000, 49000),
    ("latte", "00744", ["ГОЛУБОЙ МАТЧА СИНГЛЕ", "ГОЛУБОЙ МАТЧА ДАББЛ"], L("Moviy matcha", "Мовий матча", "Голубой матча", "Blue matcha latte"), None, 44000, 51000),
    # ---- Холодный кофе ----
    ("icedcoffee", "00745", ["АЙС ЛАТТЕ"], L("Ays latte", "Айс латте", "Айс латте", "Iced latte"), None, 49000, None),
    ("icedcoffee", "00750", ["АЙС АМЕРИКАНО"], L("Ays amerikano", "Айс американо", "Айс американо", "Iced americano"), None, 45000, None),
    ("icedcoffee", "00764", ["АЙС МАТЧА ЛАТТЕ"], L("Ays matcha latte", "Айс матча латте", "Айс матча латте", "Iced matcha latte"), None, 55000, None),
    ("icedcoffee", "00723", ["ФРАППУЧИНО КАРАМЕЛЬНЫЙ"], L("Karamelli frappuchino", "Карамелли фраппучино", "Фраппучино карамельный", "Caramel frappuccino"), None, 55000, None),
]

# Category cover photos (others fall back to the first dish photo)
COVERS = {"shashlik": "s_460a57bf.jpg"}

out = {
    "categories": [{"id": c, "name": n, "sort": i, "photo": COVERS.get(c)} for i, (c, n) in enumerate(categories)],
    "items": [
        {"category": c, "photo": f"{p}.jpg", "excel": ex, "name": n, "description": d,
         "price": pr, "price2": pr2, "sort": i}
        for i, (c, p, ex, n, d, pr, pr2) in enumerate(items)
    ],
}
json.dump(out, open("seed/menu.json", "w"), ensure_ascii=False, indent=1)
print(len(out["categories"]), "categories,", len(out["items"]), "items")
