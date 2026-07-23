alter table designs
	add column if not exists style_category text not null default '';

alter table designs
	drop constraint if exists designs_style_category_check;

alter table designs
	add constraint designs_style_category_check
	check (
		style_category in (
			'',
			'wedding_guest',
			'kente_adire',
			'menswear',
			'ready_to_wear',
			'accessories',
			'bridal'
		)
	);
