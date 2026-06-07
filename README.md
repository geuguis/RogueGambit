# RogueGambit

Es un roguelike por turnos en un tablero de 5x5, mueves a tu héroe jugando cartas que
se comportan como piezas de ajedrez (peón, caballo, alfil, torre, reina y algunas inventadas por mí), ycada movimiento es a la vez tu forma de atacar y de esquivar. Hay cuatro niveles, mejora tu mazo entre combates, y derrota al jefe final (tipico cliché).

Este es un pequeño proyecto personal hecho para practicar JavaScript de navegador sin frameworks ni build. Por qué me gustán los roguelikes y el ajedréz y no me gustó el gambonanza.


## Qué tiene

- Dos personajes (Bárbaro y Bruja).
- ~15 cartas, cada una con su patrón de movimiento y su efecto (veneno, empuje,
  área, teletransporte, cantrips que devuelven energía... etc...).
- Enemigos con IA propia: goblins, arqueros, orcos, asesinos, nigromantes que
  invocan esqueletos, un jefe que corrompe casillas, y élites distintos por bioma.
- Casillas especiales: hielo en el que resbalas, pinchos, portales emparejados,
  oro y tumbas.
- Biomas con fondos animados (cueva, hielo, magia, mazmorra y jefe).
- Campamento entre niveles: tienda, reliquias, pociones, eventos y una
  bifurcación de ruta (normal o élite).
- Combos, deshacer una jugada por nivel y un modo de dificultad (ascensión) que
  se guarda en el navegador.

## Controles

Se juega con ratón o pantalla táctil. Atajos de teclado:

- `1` `2` `3`: seleccionar carta de la mano
- `Q` `W` `E`: usar poción
- `Espacio` / `Enter`: terminar turno
- `Z`: deshacer (un uso por nivel)
- `M`: silenciar el sonido
- `Esc`: cancelar la selección o cerrar ventanas

## Tecnología

- HTML, CSS y JavaScript a pelo, sin framework ni paso de compilación.
- Animaciones coordinadas con `async/await` y delegación de eventos en el tablero.
- Tailwind por CDN para el layout, más una hoja de estilos propia para el tema,
  los fondos por bioma y las animaciones.
- Detalles de accesibilidad: etiquetas ARIA, `prefers-reduced-motion`,
  `:focus-visible` y zonas táctiles de 44px.

## Estructura

```
index.html   estructura de la página
style.css    tema, animaciones y fondos por bioma
app.js       toda la lógica del juego
```

## Licencia

MIT. Copyright (c) 2026 Guillermo Eugui Sánchez. Ver el archivo [LICENSE](LICENSE).
