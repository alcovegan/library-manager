// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	server: { port: 23170 },
	integrations: [
		starlight({
			title: 'Library Manager',
			logo: { src: './src/assets/logo.png' },
			favicon: '/favicon.png',
			customCss: ['./src/styles/custom.css'],
			description: 'Документация домашней библиотеки: desktop-приложение для macOS и Windows и мобильное приложение для iOS.',
			defaultLocale: 'root',
			locales: {
				root: { label: 'Русский', lang: 'ru' },
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/alcovegan/library-manager' }],
			editLink: {
				baseUrl: 'https://github.com/alcovegan/library-manager/edit/main/apps/docs/',
			},
			lastUpdated: true,
			sidebar: [
				{
					label: 'Начало работы',
					items: [
						{ label: 'Установка', slug: 'start/install' },
						{ label: 'Обзор интерфейса', slug: 'start/overview' },
					],
				},
				{
					label: 'Руководство',
					items: [
						{ label: 'Книги и обложки', slug: 'guide/books' },
						{ label: 'ISBN, AI и Goodreads', slug: 'guide/metadata' },
						{ label: 'Поиск и фильтры', slug: 'guide/search' },
						{ label: 'Коллекции и массовые правки', slug: 'guide/collections' },
						{ label: 'Места хранения и выдача', slug: 'guide/storage' },
						{ label: 'Чтение и статистика', slug: 'guide/reading' },
						{ label: 'Справочники и журнал', slug: 'guide/vocabulary' },
						{ label: 'Импорт и экспорт', slug: 'guide/import-export' },
						{ label: 'Синхронизация', slug: 'guide/sync' },
						{ label: 'Настройки и горячие клавиши', slug: 'guide/settings' },
					],
				},
				{
					label: 'Мобильное приложение',
					items: [
						{ label: 'Обзор', slug: 'mobile/overview' },
						{ label: 'Выкладка в TestFlight', slug: 'mobile/testflight' },
					],
				},
				{
					label: 'Справка',
					items: [
						{ label: 'Известные ограничения', slug: 'reference/limitations' },
						{ label: 'Данные и приватность', slug: 'reference/data' },
						{ label: 'Для разработчика', slug: 'reference/development' },
					],
				},
			],
		}),
	],
});
