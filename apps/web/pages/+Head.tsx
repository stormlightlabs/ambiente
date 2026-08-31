export function Head() {
	return (
		<>
			<meta name="theme-color" content="#fdf6e3" media="(prefers-color-scheme: light)" />
			<meta name="theme-color" content="#2d353b" media="(prefers-color-scheme: dark)" />
			<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
			<script
				innerHTML={`try{const saved=localStorage.getItem('ambiente-theme');const theme=saved==='dark'||saved==='light'?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch{}`}
			/>
		</>
	);
}
