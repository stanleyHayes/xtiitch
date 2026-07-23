alter table designs
	drop constraint if exists designs_style_category_check;

alter table designs
	drop column if exists style_category;
