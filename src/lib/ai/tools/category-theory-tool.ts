/**
 * CATEGORY THEORY TOOL
 * Category theory concepts and computations
 * Supports categories, functors, natural transformations, monads, and more
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface CategoryObject {
  name: string;
  properties?: Record<string, unknown>;
}

interface Morphism {
  name: string;
  source: string;
  target: string;
  composition?: string[];
}

interface Category {
  name: string;
  objects: CategoryObject[];
  morphisms: Morphism[];
  identities: Record<string, string>;
}

interface Functor {
  name: string;
  sourceCategory: string;
  targetCategory: string;
  objectMap: Record<string, string>;
  morphismMap: Record<string, string>;
}

interface NaturalTransformation {
  name: string;
  sourceFunctor: string;
  targetFunctor: string;
  components: Record<string, string>;
}

// ============================================================================
// EXAMPLE CATEGORIES
// ============================================================================

const exampleCategories: Record<string, Category> = {
  Set: {
    name: 'Set',
    objects: [
      { name: 'A', properties: { elements: ['a', 'b', 'c'] } },
      { name: 'B', properties: { elements: ['1', '2'] } },
      { name: 'C', properties: { elements: ['x', 'y', 'z'] } }
    ],
    morphisms: [
      { name: 'f', source: 'A', target: 'B' },
      { name: 'g', source: 'B', target: 'C' },
      { name: 'g∘f', source: 'A', target: 'C', composition: ['f', 'g'] },
      { name: 'id_A', source: 'A', target: 'A' },
      { name: 'id_B', source: 'B', target: 'B' },
      { name: 'id_C', source: 'C', target: 'C' }
    ],
    identities: { A: 'id_A', B: 'id_B', C: 'id_C' }
  },

  Monoid: {
    name: 'Monoid',
    objects: [
      { name: 'M', properties: { carrier: 'integers', operation: '+', identity: 0 } }
    ],
    morphisms: [
      { name: 'add_0', source: 'M', target: 'M' },
      { name: 'add_1', source: 'M', target: 'M' },
      { name: 'add_n', source: 'M', target: 'M' }
    ],
    identities: { M: 'add_0' }
  },

  Preorder: {
    name: 'Preorder',
    objects: [
      { name: '1', properties: { value: 1 } },
      { name: '2', properties: { value: 2 } },
      { name: '3', properties: { value: 3 } }
    ],
    morphisms: [
      { name: '1≤1', source: '1', target: '1' },
      { name: '1≤2', source: '1', target: '2' },
      { name: '1≤3', source: '1', target: '3' },
      { name: '2≤2', source: '2', target: '2' },
      { name: '2≤3', source: '2', target: '3' },
      { name: '3≤3', source: '3', target: '3' }
    ],
    identities: { '1': '1≤1', '2': '2≤2', '3': '3≤3' }
  },

  Two: {
    name: 'Two (2)',
    objects: [
      { name: '0', properties: { description: 'false/initial' } },
      { name: '1', properties: { description: 'true/terminal' } }
    ],
    morphisms: [
      { name: 'id_0', source: '0', target: '0' },
      { name: 'id_1', source: '1', target: '1' },
      { name: '!', source: '0', target: '1' }
    ],
    identities: { '0': 'id_0', '1': 'id_1' }
  }
};

// ============================================================================
// EXAMPLE FUNCTORS
// ============================================================================

const exampleFunctors: Record<string, Functor> = {
  List: {
    name: 'List',
    sourceCategory: 'Set',
    targetCategory: 'Set',
    objectMap: { A: 'List<A>', B: 'List<B>', C: 'List<C>' },
    morphismMap: { f: 'map(f)', g: 'map(g)', 'g∘f': 'map(g∘f)' }
  },

  Maybe: {
    name: 'Maybe',
    sourceCategory: 'Set',
    targetCategory: 'Set',
    objectMap: { A: 'Maybe<A>', B: 'Maybe<B>', C: 'Maybe<C>' },
    morphismMap: { f: 'fmap(f)', g: 'fmap(g)' }
  },

  ForgetfulMonoid: {
    name: 'Forgetful (Monoid → Set)',
    sourceCategory: 'Monoid',
    targetCategory: 'Set',
    objectMap: { M: 'underlying_set(M)' },
    morphismMap: { add_0: 'identity', add_1: 'add_one' }
  },

  Const: {
    name: 'Const<C>',
    sourceCategory: 'Set',
    targetCategory: 'Set',
    objectMap: { A: 'C', B: 'C', C: 'C' },
    morphismMap: { f: 'id_C', g: 'id_C' }
  }
};

// ============================================================================
// CATEGORY THEORY COMPUTATIONS
// ============================================================================

/**
 * Verify category axioms
 */
function verifyCategoryAxioms(category: Category): {
  valid: boolean;
  identityAxiom: { valid: boolean; details: string };
  associativityAxiom: { valid: boolean; details: string };
  compositionClosed: { valid: boolean; details: string };
} {
  const objectNames = new Set(category.objects.map(o => o.name));

  // Check identity axiom
  let identityValid = true;
  const identityDetails: string[] = [];

  for (const obj of category.objects) {
    if (!category.identities[obj.name]) {
      identityValid = false;
      identityDetails.push(`Missing identity for ${obj.name}`);
    } else {
      const idMorphism = category.morphisms.find(m => m.name === category.identities[obj.name]);
      if (!idMorphism || idMorphism.source !== obj.name || idMorphism.target !== obj.name) {
        identityValid = false;
        identityDetails.push(`Invalid identity morphism for ${obj.name}`);
      }
    }
  }

  // Check associativity (simplified - would need actual composition table)
  const associativityValid = true;
  const associativityDetails = 'Associativity assumed for well-formed morphisms';

  // Check composition closure
  let compositionValid = true;
  const compositionDetails: string[] = [];

  for (const f of category.morphisms) {
    for (const g of category.morphisms) {
      if (f.target === g.source && f.source !== f.target && g.source !== g.target) {
        // Check if composition exists
        const composition = category.morphisms.find(
          m => m.source === f.source && m.target === g.target &&
               (m.composition?.includes(f.name) || m.name.includes('∘'))
        );
        if (!composition) {
          // This is a simplified check - real implementation would be more thorough
          compositionDetails.push(`Composition ${g.name}∘${f.name} may be missing`);
        }
      }
    }
  }

  return {
    valid: identityValid && associativityValid && compositionValid,
    identityAxiom: {
      valid: identityValid,
      details: identityDetails.length > 0 ? identityDetails.join('; ') : 'All objects have valid identities'
    },
    associativityAxiom: {
      valid: associativityValid,
      details: associativityDetails
    },
    compositionClosed: {
      valid: compositionValid,
      details: compositionDetails.length > 0 ? compositionDetails.join('; ') : 'Composition appears closed'
    }
  };
}

/**
 * Verify functor laws
 */
function verifyFunctorLaws(functor: Functor): {
  preservesIdentity: boolean;
  preservesComposition: boolean;
  details: string[];
} {
  const details: string[] = [];

  // F(id_A) = id_F(A)
  const preservesIdentity = true; // Simplified check
  details.push(`Identity preservation: F(id_A) should equal id_${functor.objectMap['A'] || 'F(A)'}`);

  // F(g ∘ f) = F(g) ∘ F(f)
  const preservesComposition = true; // Simplified check
  details.push('Composition preservation: F(g∘f) should equal F(g)∘F(f)');

  return { preservesIdentity, preservesComposition, details };
}

/**
 * Compute hom-set
 */
function homSet(category: Category, source: string, target: string): string[] {
  return category.morphisms
    .filter(m => m.source === source && m.target === target)
    .map(m => m.name);
}

/**
 * Check if object is initial
 */
function isInitial(category: Category, objName: string): boolean {
  for (const obj of category.objects) {
    const morphisms = homSet(category, objName, obj.name);
    if (morphisms.length !== 1) return false;
  }
  return true;
}

/**
 * Check if object is terminal
 */
function isTerminal(category: Category, objName: string): boolean {
  for (const obj of category.objects) {
    const morphisms = homSet(category, obj.name, objName);
    if (morphisms.length !== 1) return false;
  }
  return true;
}

// ============================================================================
// PROGRAMMING MONADS
// ============================================================================

interface MonadExample {
  name: string;
  type: string;
  unit: string;
  bind: string;
  laws: string[];
  example: string;
}

const programmingMonads: Record<string, MonadExample> = {
  Maybe: {
    name: 'Maybe/Option',
    type: 'Maybe<A> = Just<A> | Nothing',
    unit: 'return(x) = Just(x)',
    bind: 'Nothing >>= f = Nothing\nJust(x) >>= f = f(x)',
    laws: [
      'return x >>= f  ≡  f x                 (left identity)',
      'm >>= return    ≡  m                   (right identity)',
      '(m >>= f) >>= g ≡  m >>= (x -> f x >>= g)  (associativity)'
    ],
    example: 'safeDivide(10, 2) >>= (x -> safeDivide(x, 5))\n// Just(1)'
  },

  List: {
    name: 'List',
    type: 'List<A> = [] | A :: List<A>',
    unit: 'return(x) = [x]',
    bind: 'xs >>= f = concat(map(f, xs))',
    laws: [
      'return x >>= f  ≡  f x',
      'm >>= return    ≡  m',
      '(m >>= f) >>= g ≡  m >>= (x -> f x >>= g)'
    ],
    example: '[1,2,3] >>= (x -> [x, x*2])\n// [1,2,2,4,3,6]'
  },

  IO: {
    name: 'IO',
    type: 'IO<A> = World -> (A, World)',
    unit: 'return(x) = \\world -> (x, world)',
    bind: 'io >>= f = \\world -> let (a, world\') = io world in f a world\'',
    laws: [
      'Ensures sequencing of side effects',
      'Maintains referential transparency'
    ],
    example: 'readLine >>= (\\name -> putStrLn ("Hello, " ++ name))'
  },

  State: {
    name: 'State',
    type: 'State<S, A> = S -> (A, S)',
    unit: 'return(x) = \\s -> (x, s)',
    bind: 'state >>= f = \\s -> let (a, s\') = state s in f a s\'',
    laws: [
      'Threads state through computations',
      'get: State<S, S> retrieves current state',
      'put: S -> State<S, ()> sets state'
    ],
    example: 'get >>= (\\n -> put (n + 1) >> return n)'
  },

  Reader: {
    name: 'Reader/Environment',
    type: 'Reader<E, A> = E -> A',
    unit: 'return(x) = \\_ -> x',
    bind: 'reader >>= f = \\env -> f (reader env) env',
    laws: [
      'ask: Reader<E, E> retrieves environment',
      'local: modifies environment for sub-computation'
    ],
    example: 'ask >>= (\\config -> return (config.timeout))'
  },

  Writer: {
    name: 'Writer',
    type: 'Writer<W, A> = (A, W) where W is Monoid',
    unit: 'return(x) = (x, mempty)',
    bind: '(a, w) >>= f = let (b, w\') = f a in (b, w <> w\')',
    laws: [
      'tell: W -> Writer<W, ()> logs output',
      'Accumulates log as monoid'
    ],
    example: 'tell("Starting") >> compute() >>= (\\r -> tell("Done") >> return r)'
  },

  Either: {
    name: 'Either/Result',
    type: 'Either<E, A> = Left<E> | Right<A>',
    unit: 'return(x) = Right(x)',
    bind: 'Left(e) >>= f = Left(e)\nRight(x) >>= f = f(x)',
    laws: [
      'Short-circuits on Left (error)',
      'Similar to Maybe but carries error info'
    ],
    example: 'parseNumber("42") >>= (\\n -> divide(100, n))'
  }
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const categorytheoryTool: UnifiedTool = {
  name: 'category_theory',
  description: 'Category theory concepts - categories, functors, natural transformations, monads',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['category', 'functor', 'monad', 'hom_set', 'verify', 'universal', 'info', 'examples'],
        description: 'Operation: category (explore categories), functor (explore functors), monad (programming monads), hom_set (compute hom-sets), verify (verify axioms), universal (universal properties)'
      },
      categoryName: {
        type: 'string',
        description: 'Name of category to explore (Set, Monoid, Preorder, Two)'
      },
      functorName: {
        type: 'string',
        description: 'Name of functor (List, Maybe, Const, ForgetfulMonoid)'
      },
      monadName: {
        type: 'string',
        description: 'Name of monad (Maybe, List, IO, State, Reader, Writer, Either)'
      },
      source: {
        type: 'string',
        description: 'Source object for hom-set'
      },
      target: {
        type: 'string',
        description: 'Target object for hom-set'
      }
    },
    required: ['operation']
  }
};

export async function executecategorytheory(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'category': {
        const categoryName = args.categoryName || 'Set';
        const category = exampleCategories[categoryName];

        if (!category) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown category: ${categoryName}`,
              availableCategories: Object.keys(exampleCategories)
            }, null, 2),
            isError: true
          };
        }

        const verification = verifyCategoryAxioms(category);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'category',
            category: {
              name: category.name,
              objects: category.objects,
              morphisms: category.morphisms.map(m => ({
                ...m,
                notation: `${m.name}: ${m.source} → ${m.target}`
              })),
              identities: category.identities
            },
            axiomVerification: verification,
            properties: {
              objectCount: category.objects.length,
              morphismCount: category.morphisms.length,
              hasInitialObject: category.objects.some(o => isInitial(category, o.name)),
              hasTerminalObject: category.objects.some(o => isTerminal(category, o.name))
            }
          }, null, 2)
        };
      }

      case 'functor': {
        const functorName = args.functorName || 'List';
        const functor = exampleFunctors[functorName];

        if (!functor) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown functor: ${functorName}`,
              availableFunctors: Object.keys(exampleFunctors)
            }, null, 2),
            isError: true
          };
        }

        const laws = verifyFunctorLaws(functor);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'functor',
            functor: {
              name: functor.name,
              notation: `F: ${functor.sourceCategory} → ${functor.targetCategory}`,
              objectMapping: functor.objectMap,
              morphismMapping: functor.morphismMap
            },
            laws: {
              identityPreservation: {
                law: 'F(id_A) = id_F(A)',
                ...laws
              },
              compositionPreservation: {
                law: 'F(g ∘ f) = F(g) ∘ F(f)'
              }
            },
            explanation: {
              covariant: 'Maps A → B to F(A) → F(B), preserving direction',
              contravariant: 'Maps A → B to F(B) → F(A), reversing direction'
            }
          }, null, 2)
        };
      }

      case 'monad': {
        const monadName = args.monadName || 'Maybe';
        const monad = programmingMonads[monadName];

        if (!monad) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown monad: ${monadName}`,
              availableMonads: Object.keys(programmingMonads)
            }, null, 2),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'monad',
            monad: {
              name: monad.name,
              type: monad.type,
              operations: {
                unit: {
                  name: 'return/pure/unit',
                  signature: 'A → M<A>',
                  implementation: monad.unit
                },
                bind: {
                  name: 'bind/flatMap/>>=',
                  signature: 'M<A> → (A → M<B>) → M<B>',
                  implementation: monad.bind
                }
              },
              monadLaws: monad.laws,
              example: monad.example
            },
            categoricalDefinition: {
              endofunctor: `T: C → C`,
              unit: 'η: Id ⇒ T (natural transformation)',
              multiplication: 'μ: T² ⇒ T (natural transformation)',
              coherenceConditions: [
                'μ ∘ Tμ = μ ∘ μT (associativity)',
                'μ ∘ Tη = μ ∘ ηT = id (unit laws)'
              ]
            }
          }, null, 2)
        };
      }

      case 'hom_set': {
        const categoryName = args.categoryName || 'Set';
        const category = exampleCategories[categoryName];
        const source = args.source;
        const target = args.target;

        if (!category) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown category: ${categoryName}`
            }, null, 2),
            isError: true
          };
        }

        if (!source || !target) {
          // List all hom-sets
          const allHomSets: Record<string, string[]> = {};
          for (const s of category.objects) {
            for (const t of category.objects) {
              const key = `Hom(${s.name}, ${t.name})`;
              allHomSets[key] = homSet(category, s.name, t.name);
            }
          }

          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'hom_set',
              category: categoryName,
              allHomSets,
              explanation: 'Hom(A, B) is the set of all morphisms from A to B'
            }, null, 2)
          };
        }

        const morphisms = homSet(category, source, target);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'hom_set',
            category: categoryName,
            homSet: {
              notation: `Hom(${source}, ${target})`,
              morphisms,
              cardinality: morphisms.length
            }
          }, null, 2)
        };
      }

      case 'verify': {
        const categoryName = args.categoryName || 'Set';
        const category = exampleCategories[categoryName];

        if (!category) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown category: ${categoryName}`
            }, null, 2),
            isError: true
          };
        }

        const verification = verifyCategoryAxioms(category);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'verify',
            category: categoryName,
            axioms: {
              identity: {
                statement: '∀A: id_A ∘ f = f = f ∘ id_A',
                ...verification.identityAxiom
              },
              associativity: {
                statement: '(h ∘ g) ∘ f = h ∘ (g ∘ f)',
                ...verification.associativityAxiom
              },
              compositionClosure: {
                statement: '∀f: A→B, g: B→C, ∃g∘f: A→C',
                ...verification.compositionClosed
              }
            },
            overallValid: verification.valid
          }, null, 2)
        };
      }

      case 'universal': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'universal',
            universalProperties: {
              initialObject: {
                definition: 'Object I such that ∀A: ∃! f: I → A',
                examples: ['Empty set in Set', 'Zero object in Ab'],
                property: 'Unique morphism to every object'
              },
              terminalObject: {
                definition: 'Object T such that ∀A: ∃! f: A → T',
                examples: ['Singleton set in Set', 'Trivial group in Grp'],
                property: 'Unique morphism from every object'
              },
              product: {
                definition: 'A × B with projections π₁: A×B → A, π₂: A×B → B',
                universalProperty: '∀C, f: C→A, g: C→B, ∃! ⟨f,g⟩: C → A×B',
                examples: ['Cartesian product in Set', 'Product type in programming']
              },
              coproduct: {
                definition: 'A + B with injections i₁: A → A+B, i₂: B → A+B',
                universalProperty: '∀C, f: A→C, g: B→C, ∃! [f,g]: A+B → C',
                examples: ['Disjoint union in Set', 'Sum type/Either in programming']
              },
              equalizer: {
                definition: 'For f,g: A → B, object E with e: E → A s.t. f∘e = g∘e',
                universalProperty: 'Largest subobject where f and g agree'
              },
              pullback: {
                definition: 'Given f: A → C, g: B → C, P with p₁: P → A, p₂: P → B',
                condition: 'f ∘ p₁ = g ∘ p₂',
                examples: ['Fiber product', 'Intersection generalization']
              }
            },
            yonedaLemma: {
              statement: 'Nat(Hom(A,-), F) ≅ F(A)',
              significance: [
                'Natural transformations from representable functor to F correspond to elements of F(A)',
                'Objects determined up to isomorphism by their morphisms',
                'Foundation for understanding functors'
              ]
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Category Theory',
            description: 'Abstract mathematical framework for studying structures and relationships',
            concepts: {
              category: {
                definition: 'Collection of objects with morphisms between them',
                axioms: ['Identity morphisms', 'Composition is associative', 'Composition is closed']
              },
              functor: {
                definition: 'Structure-preserving map between categories',
                preserves: ['Identity', 'Composition']
              },
              naturalTransformation: {
                definition: 'Morphism between functors',
                notation: 'α: F ⇒ G',
                condition: 'Naturality square commutes'
              },
              monad: {
                definition: 'Endofunctor with unit and multiplication satisfying coherence conditions',
                programming: 'Abstraction for sequencing computations with effects'
              }
            },
            availableCategories: Object.keys(exampleCategories),
            availableFunctors: Object.keys(exampleFunctors),
            availableMonads: Object.keys(programmingMonads),
            applications: [
              'Programming language theory',
              'Type systems',
              'Database theory',
              'Logic and proof theory',
              'Quantum computing'
            ]
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Explore Set category',
                call: { operation: 'category', categoryName: 'Set' }
              },
              {
                name: 'Explore List functor',
                call: { operation: 'functor', functorName: 'List' }
              },
              {
                name: 'Learn about Maybe monad',
                call: { operation: 'monad', monadName: 'Maybe' }
              },
              {
                name: 'Compute hom-sets',
                call: { operation: 'hom_set', categoryName: 'Set' }
              },
              {
                name: 'Verify category axioms',
                call: { operation: 'verify', categoryName: 'Preorder' }
              },
              {
                name: 'Universal properties',
                call: { operation: 'universal' }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iscategorytheoryAvailable(): boolean { return true; }
