// The note left for whoever reads the source. It is printed to the console
// when the page loads (app/layout.tsx) and written as the first thing in the
// exported HTML, above <html> (scripts/sign-export.mjs), so it is the first
// line of view-source and of the inspector's tree.
//
// The tree is pixel art in half-block characters, two pixels to a character,
// so it comes out square in a monospace face; it was dithered from a small
// silhouette and is kept here as it came out. No double hyphens anywhere in
// the note: they are not allowed inside an HTML comment.
export const SOURCE_NOTE = `
                   ▄▀ ▀▄▀ ▀▄
           ▄ ▄▀ ▀█▀▄▀▄▀▄▀▄▀▄▀▄
         ▄▀█▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀█▀ ▀█
       ▄██▀███▀▄▀█▀█▀█▀█▀█▀█▀█▀█▀█
       █████▀███▀█▀█▀███▀███▀███▀▄█
       █████████████▀███████▀█▀███
       ▀████████████▀███████████▀
          ▀▀▀▀▀▀▀█████▀▀▀
                   ▀██
                    ██▄
                   ▄███
              ▄▄▄████████▄


    ETH_TREE_01 is a visual experiment.

    Ethereum's market history read as the rings of a tree: one ring a
    year, price for shape, volume for weight, milestones for knots.
    Every detail on the sheet was drawn on purpose.

    If you need someone who cares this much about what people see,
    I am open for opportunities.

    Frann Dalmasso
    francomdalmasso@gmail.com
    https://www.linkedin.com/in/franndalmasso
`;

export const SOURCE_COMMENT = `<!--\n${SOURCE_NOTE}\n-->`;
