const fs = require('fs');
let code = fs.readFileSync('js/factors.js', 'utf8');

const icons = {
  calor: 'fluent:temperature-24-filled',
  sol: 'fluent:weather-sunny-24-filled',
  vento: 'fluent:weather-duststorm-24-filled', // or leaf
  umidade: 'fluent:weather-humidity-24-filled',
  ar: 'fluent:weather-haze-24-filled', // or lungs? 
  chuva: 'fluent:weather-rain-24-filled'
};

code = code.replace(/id:\s*'calor'[\s\S]*?icona:\s*I\([^)]+\),/, "id: 'calor',\n      nome: 'Calor',\n      icona: '<span class=\"iconify\" data-icon=\"fluent:temperature-24-filled\"></span>',");
code = code.replace(/id:\s*'sol'[\s\S]*?icona:\s*I\([^)]+\),/, "id: 'sol',\n      nome: 'Sol',\n      icona: '<span class=\"iconify\" data-icon=\"fluent:weather-sunny-24-filled\"></span>',");
code = code.replace(/id:\s*'vento'[\s\S]*?icona:\s*I\([^)]+\),/, "id: 'vento',\n      nome: 'Vento',\n      icona: '<span class=\"iconify\" data-icon=\"fluent:flag-24-filled\"></span>',"); // using flag for wind
code = code.replace(/id:\s*'umidade'[\s\S]*?icona:\s*I\([^)]+\),/, "id: 'umidade',\n      nome: 'Umidade',\n      icona: '<span class=\"iconify\" data-icon=\"fluent:weather-humidity-24-filled\"></span>',");
code = code.replace(/id:\s*'ar'[\s\S]*?icona:\s*I\([^)]+\),/, "id: 'ar',\n      nome: 'Ar',\n      icona: '<span class=\"iconify\" data-icon=\"fluent:weather-duststorm-24-filled\"></span>',");
code = code.replace(/id:\s*'chuva'[\s\S]*?icona:\s*I\([^)]+\),/, "id: 'chuva',\n      nome: 'Chuva',\n      icona: '<span class=\"iconify\" data-icon=\"fluent:weather-rain-24-filled\"></span>',");

fs.writeFileSync('js/factors.js', code);
