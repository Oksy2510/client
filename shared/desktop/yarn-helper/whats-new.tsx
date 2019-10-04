/* eslint-disable sort-keys */
import fs from 'fs'
import path from 'path'
import readline from 'readline'
// import releasesJSON from '../../whats-new/releases-gen.ts'
const releasesJSON = {}

const commands = {
  'create-release': {
    code: createRelease,
    help: 'Update release information for "What\'s New" notifier',
  },
}
/*
 * Questions
 *
 * 1. *required <string> What is the version of the new release?
 * 2. *required <number> How many new features are being hihglighted?
 * 3. LOOP for {n} features
 *    1. *required <string> "What is the feature text?"
 *    2. *optional <boolean> "Is there an image to include in this feature? (y/n)"
 *        1. *required <string> "What is the path of the image?" (must be in client/shared/images)
 *          - Test that the path is valid and an image exists there
 *          - (?) Perhaps enforce that images are `.png` as well?
 *    3. *optional* <boolean> "Is there a primary button to include in this feature? (y/n)"
 *        1. *required <string> "What is the button text?"
 *        2. *required <string> "What path should the button open?"
 *        3. *required <boolean> "Is this path external (web URL)? (y/n)"
 *    4. *optional <boolean> [if primary = true] "Is there a secondary button to include in this feature? (y/n)"
 *        1. *required <string> "What is the button text?"
 *        2. *required <string> "What path should the button open?"
 *        3. *required <boolean> "Is this path external (web URL)? (y/n)"
 *
 * 4. Confirm that the *oldest* (lastLast) version will be removed from the
 * JSON file and its assets located in `client/shared/iamges/releases` will be
 * deleted
 *
 */

type Questions = {
  [key: string]: {
    question: Question
    next: nextFn
  }
}

type Question = {
  required: boolean
  text: string
  validator: validatorFn
  update: updateWithAccumulatorFn
}
type validatorFn = (answer: string) => {valid: boolean; message: string}
type updateWithAccumulatorFn = (acc: object, answer: string) => object
type nextFn = (answer?: string) => string | null

type Feature = {
  text: string
  image?: string
  primaryButton: {
    text: string
    path: string
    external: boolean
  } | null
  secondaryButton: {
    text: string
    path: string
    external: boolean
  } | null
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Source: https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
const formatQuestion = (question: string) => `❓${question}:\n`

const questions: Questions = {
  version: {
    question: {
      required: true,
      text: '(Required) What is version of this release? (MAJOR.MINOR.PATCH)',
      validator: answer => {
        const match = answer.match(semverRegex)
        const valid = match ? !!match.length : false
        return valid
          ? {valid, message: ''}
          : {valid, message: 'Version must match semantic vesioning (MAJOR.MINOR.PATCH)'}
      },
      update: (current, answer) => {
        return {
          ...current,
          version: answer,
        }
      },
    },
    next: () => 'numberOfFeatures',
  },
  numberOfFeatures: {
    question: {
      required: true,
      text: 'How many features to add to "What\'s New" in this release?',
      validator: answer => {
        const num = Number(answer)
        const isNumber = !isNaN(num)
        return isNumber
          ? num > 0
            ? {valid: true, message: ''}
            : {valid: false, message: 'Need at least one feature to highlight this release'}
          : {valid: false, message: 'Must be a number'}
      },
      update: (current, answer) => {
        const numFeatures = Number(answer)
        const featuresArray = Array(numFeatures).fill({})
        return {
          ...current,
          features: featuresArray,
        }
      },
    },
    next: () => null,
  },
  // Questions are repeated {numberOfFeatures} times
  featureText: {
    question: {
      required: true,
      text: 'Enter a description of this feature',
      validator: answer => {
        return answer ? {valid: true, message: ''} : {valid: false, message: 'Enter a description'}
      },
      update: (currentVersion, answer) => {
        return {
          ...currentVersion,
          text: answer,
        }
      },
    },
    next: () => 'featureImage',
  },
  featureImage: {
    question: {
      required: false,
      text:
        '(Optional) Enter a path to an image asset.\nE.g. ./images/releases/{MAJOR.MINOR.PATCH}/image-name.png',
      validator: answer => {
        const exists = fs.existsSync(answer)
        return exists
          ? {valid: true, message: ''}
          : {valid: false, message: `Image file at path ${path.resolve(answer)} does not exist.`}
      },
      update: (currentFeature, answer) => {
        return {
          ...currentFeature,
          image: answer || null,
        }
      },
    },
    next: () => 'featurePrimaryButton',
  },
  featurePrimaryButton: {
    question: {
      required: false,
      text: '(Optional) Does this feature have a primary button? (y/n)',
      validator: answer => {
        // At this point we have an answer than is not an empty string, so it must be either 'y' or 'n'
        return answer === 'y'
          ? {valid: true, message: ''}
          : answer === 'n'
          ? {valid: true, message: ''}
          : {valid: false, message: 'Enter either (y/n)'}
      },
      update: (currentFeature, answer) => {
        // Initialize the primaryButton object
        if (answer === 'y') {
          return {
            ...currentFeature,
            primaryButton: {},
          }
        } else {
          return {
            ...currentFeature,
            primaryButton: null,
            secondaryButton: null,
          }
        }
      },
    },
    next: answer => (answer && answer == 'y' ? 'featurePrimayButtonText' : null),
  },
  featurePrimayButtonText: {
    question: {
      required: true,
      text: '(Required) Enter text for the primary button',
      validator: answer => {
        return answer ? {valid: true, message: ''} : {valid: false, message: ''}
      },
      update: (currentFeature, answer) => {
        return {
          ...currentFeature,
          primaryButton: {
            // Dynamically building the object, primaryButton does exist
            // @ts-ignore
            ...currentFeature.primaryButton,
            text: answer,
          },
        }
      },
    },
    next: () => 'featurePrimaryButtonExternal',
  },
  featurePrimaryButtonExternal: {
    question: {
      required: true,
      text: '(Required) Will this button navigate to an web URL? (y/n)',
      validator: answer => {
        // At this point we have an answer than is not an empty string, so it must be either 'y' or 'n'
        return answer === 'y'
          ? {valid: true, message: ''}
          : answer === 'n'
          ? {valid: true, message: ''}
          : {valid: false, message: 'Enter either (y/n)'}
      },
      update: (currentFeature, answer) => {
        return {
          ...currentFeature,
          primaryButton: {
            // Dynamically building the object, primaryButton does exist
            // @ts-ignore
            ...currentFeature.primaryButton,
            external: answer === 'y',
          },
        }
      },
    },
    next: () => 'featurePrimaryButtonPath',
  },
  featurePrimaryButtonPath: {
    question: {
      required: true,
      text: '(Required) Enter the path the button will navigate to',
      validator: answer => {
        return answer ? {valid: true, message: ''} : {valid: false, message: ''}
      },
      update: (currentFeature, answer) => {
        return {
          ...currentFeature,
          primaryButton: {
            // Dynamically building the object, primaryButton does exist
            // @ts-ignore
            ...currentFeature.primaryButton,
            path: answer,
          },
        }
      },
    },
    next: () => 'featureSecondaryButton',
  },
  featureSecondaryButton: {
    question: {
      required: false,
      text: '(Optional) Does this feature have a secondary button? (y/n)',
      validator: answer => {
        // At this point we have an answer than is not an empty string, so it must be either 'y' or 'n'
        return answer === 'y'
          ? {valid: true, message: ''}
          : answer === 'n'
          ? {valid: true, message: ''}
          : {valid: false, message: 'Enter either (y/n)'}
      },
      update: (currentFeature, answer) => {
        // Initialize the secondaryButton object
        return {
          ...currentFeature,
          secondaryButton: answer == 'y' ? {} : null,
        }
      },
    },
    next: answer => (answer && answer === 'y' ? 'featureSecondaryButtonText' : null),
  },
  featureSecondaryButtonText: {
    question: {
      required: true,
      text: '(Required) Enter text for the secondary button',
      validator: answer => {
        return answer ? {valid: true, message: ''} : {valid: false, message: ''}
      },
      update: (currentFeature, answer) => {
        return {
          ...currentFeature,
          secondaryButton: {
            // Dynamically building the object, secondaryButton does exist
            // @ts-ignore
            ...currentFeature.secondaryButton,
            text: answer,
          },
        }
      },
    },
    next: () => 'featureSecondaryButtonExternal',
  },
  featureSecondaryButtonExternal: {
    question: {
      required: true,
      text: '(Required) Will this button navigate to an web URL? (y/n)',
      validator: answer => {
        // At this point we have an answer than is not an empty string, so it must be either 'y' or 'n'
        return answer === 'y'
          ? {valid: true, message: ''}
          : answer === 'n'
          ? {valid: true, message: ''}
          : {valid: false, message: 'Enter either (y/n)'}
      },
      update: (currentFeature, answer) => {
        return {
          ...currentFeature,
          secondaryButton: {
            // Dynamically building the object, secondaryButton does exist
            // @ts-ignore
            ...currentFeature.secondaryButton,
            external: answer === 'y',
          },
        }
      },
    },
    next: () => 'featureSecondaryButtonPath', // marks the end
  },
  featureSecondaryButtonPath: {
    question: {
      required: true,
      text: '(Required) Enter the path the button will navigate to',
      validator: answer => {
        return answer ? {valid: true, message: ''} : {valid: false, message: ''}
      },
      update: (currentFeature, answer) => {
        return {
          ...currentFeature,
          secondaryButton: {
            // Dynamically building the object, secondaryButton does exist
            // @ts-ignore
            ...currentFeature.secondaryButton,
            path: answer,
          },
        }
      },
    },
    next: () => null,
  },
}

const requiredQuestion = (...args: [string, validatorFn]): Promise<string> => {
  const [question, validator] = args
  const formattedQuestion = formatQuestion(question)
  return new Promise(resolve => {
    rl.question(formattedQuestion, answer => {
      if (!answer) {
        console.log('Required: Please enter a value')
        return resolve(requiredQuestion(...args))
      }
      const {valid, message} = validator(answer)
      if (!valid) {
        console.log(`${message}\n`)
        return resolve(requiredQuestion(...args))
      }
      return resolve(answer)
    })
  })
}

const optionalQuestion = (...args: [string, validatorFn]): Promise<string | null> => {
  const [question, validator] = args
  const formattedQuestion = formatQuestion(question)
  return new Promise(resolve => {
    rl.question(`${formattedQuestion}\n<Return> to skip`, (answer: string) => {
      if (!answer) {
        return resolve(null)
      }
      const {valid, message} = validator(answer)
      if (!valid) {
        console.log(`${message}\n`)
        resolve(optionalQuestion(...args))
        return
      }
      resolve(answer)
      return
    })
  })
}
const chainQuestions = async (question: Question, next: nextFn, currentObj: {}) => {
  if (question.required) {
    const answer = await requiredQuestion(question.text, question.validator)
    const newObj = question.update(currentObj, answer)

    const nextName = next(answer)
    // Base case, last question, and populated object
    if (!nextName) {
      return newObj
    }
    // Continue to next question
    const {question: nextQuestion, next: nextNext} = questions[nextName]
    console.log('\n')
    return await chainQuestions(nextQuestion, nextNext, newObj)
  } else {
    const answer = await optionalQuestion(question.text, question.validator)
    const newObj = question.update(currentObj, answer || '')

    // User skipped optional questions, go to the next question
    if (!answer) {
      const nextName = next()
      // Base case, last question, and populated object
      if (!nextName) {
        return newObj
      }
      // Continue to next question
      const {question: nextQuestion, next: nextNext} = questions[nextName]
      console.log('\n')
      return await chainQuestions(nextQuestion, nextNext, newObj)
    }
    // Answer provided, update the feature, go to the next question
    else {
      const nextName = next(answer)
      // Base case, last question, and populated object
      if (!nextName) {
        return newObj
      }
      // Continue to next question
      const {question: nextQuestion, next: nextNext} = questions[nextName]
      console.log('\n')
      return await chainQuestions(nextQuestion, nextNext, newObj)
    }
  }
}

/*
 * createRelease will execute a chain of linked questions that take input via
 * STDIN and build a new release JSON file located at
 * 'client/shared/whats-new/releases-gen.tsx'
 *
 * It will also manage image assets for new versions by checking that they are
 * in the correct location as well as removing old assets when a version is no
 * longer included in 'What's New'
 */
async function createRelease() {
  // Kick off the release questions by starting with 'version' then 'number of features' questions
  const emptyVersion = {}
  const {question: versionQuestion, next: versionNext} = questions.version
  const updatedVersion = await chainQuestions(versionQuestion, versionNext, emptyVersion)

  // -- At this point we have an object that looks like:
  // {
  //    version: 'X.X.X',
  //    features: [ {}, ... ], // with {numFeatures} of empty objects
  // }

  const featuresPromiseChain = updatedVersion.features
    .map((emptyFeature: {}) => {
      const {question: featureTextQuestion, next: featureTextNext} = questions.featureText
      const args = [featureTextQuestion, featureTextNext, emptyFeature]
      return args
    })
    // Sequentially execute {numFeatures} chains of feature questions
    // Then merge each Feature object into an array features = [ Feature1, Feature2, ... ]
    .reduce((prevChain: Promise<Array<Feature>>, args: [Question, nextFn, {}], index: number) => {
      return prevChain.then(features => {
        console.log('\n')
        console.log(`Feature ${index + 1}`)
        console.log('--------------------')
        return chainQuestions(...args).then((newFeature: Feature) => {
          return [...features, newFeature]
        })
      })
    }, Promise.resolve([]))
  const updatedFeatures = await featuresPromiseChain
  // -- At this pont we have an object that looks like:
  // {
  //    version: 'X.X.X',
  //    features: [
  //      {
  //        text: '...',
  //        image: '...' | null,
  //        primaryButton: {
  //          text: '...',
  //          path: '...',
  //          external: true | false
  //        } | null,
  //        secondaryButton: {
  //          text: '...',
  //          path: '...',
  //          external: true | false
  //        } | null
  //      },
  //
  //      ...
  //    ]
  // }

  const newVersion = {
    ...updatedVersion,
    features: updatedFeatures,
  }

  const newReleaseGen = {
    current: newVersion,
    last: releasesJSON.current,
    lastLast: releasesJSON.last,
  }

  // Remove images from images directory when releasesJSON.lastLast is no longer used

  console.log('DEBUG: FINALLY DONE', JSON.stringify(newVersion, null, 4))

  process.exit(0)
}

export default commands
