export function seedWiki(db){
 const rows=[['handbook',null,'Работа команды','# Работа команды\n\nСогласованные правила.\n\n## График\n\nПланёрки по Тбилиси.\n\n## Связь\n\nОтвет клиенту в рабочее время.',0],['testing','handbook','Тестирование кампаний','# Тестирование\n\nУникальная методика.\n\n| Этап | Результат |\n| --- | --- |\n| Проверка | Готово |\n\n- Проверить доступы\n- Собрать материалы\n\n<script>window.wikiXss=true</script>\n[Опасная ссылка](javascript:alert(1))\n\n[Внешняя инструкция](https://example.com/guide)',1],['tools',null,'Инструменты','Полезные ссылки и материалы команды.',2]];
 rows.push(['preserve',null,'Сохранность материалов','1\\. Это нумерация внутри текста.\n\n\\- Это дефис внутри текста.\n\n[](<https://example.com/attachment>)\n\n| Поле | Значение |\n| --- | --- |\n| Ссылка | Материал |',3]);
 for(const r of rows)db.prepare("INSERT INTO wiki_pages(id,parent_id,title,body,sort_order,updated_by) VALUES(?,?,?,?,?,'synthetic')").run(...r);
 db.exec('INSERT INTO wiki_revisions(page_id,version,title,body,actor) SELECT id,version,title,body,updated_by FROM wiki_pages');
}
