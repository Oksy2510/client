/* eslint-disable sort-keys */
import fs from 'fs'
import path from 'path'
import prettier from 'prettier'
import readline from 'readline'
import rimraf from 'rimraf'
import releasesJSON from '../../whats-new/releases-gen'

const commands = {
  'whats-new': {
    code: updateWhatsNew,
    help: 'Update release information for "What\'s New" notifier',
  },
}

const paths = {
  releaseGen: path.resolve(__dirname, '..', '..', 'whats-new', 'releases-gen.tsx'),
  whatsNew: path.resolve(__dirname, '..', '..', './whats-new/'),
}

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

// Source: https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const semverRegex = /(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?/
const validPathRegex = new RegExp(`^\.\./images/releases/${semverRegex.source}/.*$`)
const formatQuestion = (question: string) => `❓ ${question}:\n`

const questions: Questions = {
  version: {
    question: {
      required: true,
      text: 'What is version of this release? (MAJOR.MINOR.PATCH)',
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
      text: 'Enter a path to an image asset.\nE.g. ./images/releases/{MAJOR.MINOR.PATCH}/image-name.png',
      validator: answer => {
        const relativePathFromWhatsNew = path.relative(paths.whatsNew, answer)
        const absPathFromWhatsNew = path.resolve(paths.whatsNew, relativePathFromWhatsNew)
        const isValidPath = relativePathFromWhatsNew.match(validPathRegex)
        const exists = fs.existsSync(absPathFromWhatsNew)
        return isValidPath && exists
          ? {valid: true, message: ''}
          : {valid: false, message: `Image file at path ${absPathFromWhatsNew} does not exist.`}
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
      required: true,
      text: 'Does this feature have a primary button? (y/n)',
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
      text: 'Enter text for the primary button',
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
      text: 'Will this button navigate to an web URL? (y/n)',
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
      text: 'Enter the path the button will navigate to',
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
      required: true,
      text: 'Does this feature have a secondary button? (y/n)',
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
      text: 'Enter text for the secondary button',
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
      text: 'Will this button navigate to an web URL? (y/n)',
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
      text: 'Enter the path the button will navigate to',
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

const requiredQuestion = (...args: [readline.Interface, string, validatorFn]): Promise<string> => {
  const [rl, question, validator] = args
  const formattedQuestion = formatQuestion(question)
  return new Promise(resolve => {
    rl.question(formattedQuestion, answer => {
      if (!answer) {
        console.log('Required: Please enter a value')
        return resolve(requiredQuestion(...args))
      }
      const {valid, message} = validator(answer)
      if (!valid) {
        console.log(`⚠️ ${message}\n`)
        return resolve(requiredQuestion(...args))
      }
      return resolve(answer)
    })
  })
}

const optionalQuestion = (...args: [readline.Interface, string, validatorFn]): Promise<string | null> => {
  const [rl, question, validator] = args
  const formattedQuestion = formatQuestion(question)
  return new Promise(resolve => {
    rl.question(`(Optional) ${formattedQuestion}\n<Return> to skip\n`, (answer: string) => {
      if (!answer) {
        return resolve(null)
      }
      const {valid, message} = validator(answer)
      if (!valid) {
        console.log(`⚠️ Invalid: ${message}\n`)
        resolve(optionalQuestion(...args))
        return
      }
      resolve(answer)
      return
    })
  })
}
const chainQuestions = async (rl: readline.Interface, question: Question, next: nextFn, currentObj: {}) => {
  if (question.required) {
    const answer = await requiredQuestion(rl, question.text, question.validator)
    const newObj = question.update(currentObj, answer)

    const nextName = next(answer)
    // Base case, last question, and populated object
    if (!nextName) {
      return newObj
    }
    // Continue to next question
    const {question: nextQuestion, next: nextNext} = questions[nextName]
    console.log('\n')
    return await chainQuestions(rl, nextQuestion, nextNext, newObj)
  } else {
    const answer = await optionalQuestion(rl, question.text, question.validator)
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
      return await chainQuestions(rl, nextQuestion, nextNext, newObj)
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
      return await chainQuestions(rl, nextQuestion, nextNext, newObj)
    }
  }
}

/*
 * updateWhatsNew will execute a chain of linked questions that take input via
 * STDIN and build a new release JSON file located at
 * 'client/shared/whats-new/releases-gen.tsx'
 *
 * It will also manage image assets for new versions by checking that they are
 * in the correct location as well as removing old assets when a version is no
 * longer included in 'What's New'
 */
async function updateWhatsNew() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  // Kick off the release questions by starting with 'version' then 'number of features' questions
  const emptyVersion = {}
  const {question: versionQuestion, next: versionNext} = questions.version
  const updatedVersion = await chainQuestions(rl, versionQuestion, versionNext, emptyVersion)

  const featuresPromiseChain = updatedVersion.features
    .map((emptyFeature: {}) => {
      const {question: featureTextQuestion, next: featureTextNext} = questions.featureText
      const args = [rl, featureTextQuestion, featureTextNext, emptyFeature]
      return args
    })
    // Sequentially execute {numFeatures} chains of feature questions
    // Then merge each Feature object into an array features = [ FeatureChain1, FeatureChain2, ... ]
    .reduce(
      (
        prevChain: Promise<Array<Feature>>,
        args: [readline.Interface, Question, nextFn, {}],
        index: number
      ) => {
        return prevChain.then(prevFeatures => {
          console.log('\n')
          console.log(`Feature ${index + 1}`)
          console.log('--------------------')
          return chainQuestions(...args).then((nextFeature: Feature) => {
            return [...prevFeatures, nextFeature]
          })
        })
      },
      Promise.resolve([])
    )

  const newFeatures = await featuresPromiseChain
  const newRelease = {
    current: {
      ...updatedVersion,
      features: newFeatures,
    },
    last: releasesJSON.current,
    lastLast: releasesJSON.last,
  }

  // Write new release-gen.json
  try {
    await writeNewReleaseGen(newRelease)
  } catch (_) {
    console.warn(`(Error): Failed to write to ${paths.releaseGen}`)
    rl.close()
    return
  }

  // Remove images from images directory when releasesJSON.lastLast is no longer used
  await cleanUpOldImages(rl, releasesJSON.lastLast)

  rl.close()
}

function writeNewReleaseGen(newRelease) {
  const template = `// NOTE: This file is GENERATED from user input via \`yarn whats-new\`
//
// When current.version is different than the user's latest version (synced via
// gregor) then the items in current.features will be marked as unseen
/* eslint-disable sort-keys */
const releases = ${JSON.stringify(newRelease, null, 4)}
export default releases
  `

  const formattedRelease = prettier.format(template, {
    ...prettier.resolveConfig.sync(paths.releaseGen),
    parser: 'typescript',
  })

  return new Promise((resolve, reject) => {
    fs.writeFile(paths.releaseGen, formattedRelease, err => {
      if (err) reject(err)
      console.log(`✅ Update ${paths.releaseGen}. Final output:`)
      console.log(formattedRelease)
      resolve()
    })
  })
}

/*
 * 1. Read through and check if there are images in any of the features
 * 2. Collect the images and check which exist
 * 3. Tell the user which images exist and ask for each one if they would like to remove them.
 * 4. Delete each file
 */
async function cleanUpOldImages(rl, oldestRelease) {
  if (oldestRelease.features && oldestRelease.features.length) {
    const oldImagePaths: Array<string> = oldestRelease.features
      .map((feature: Feature) => (feature && feature.image ? feature.image : null))
      .filter(Boolean)
      .filter((p: string) => p.match(validPathRegex))

    if (!oldImagePaths.length) {
      return
    }

    const enclosingDirsMap = oldImagePaths.reduce((acc, p) => {
      const {dir: enclosingDirPath} = path.parse(path.resolve(__dirname, path.relative(paths.whatsNew, p)))
      const {base} = path.parse(enclosingDirPath)
      const isSemverDir = base.match(semverRegex) !== null
      return {
        ...acc,
        [enclosingDirPath]: isSemverDir,
      }
    }, {})

    // Check if any images do not match `images/oldestReleases/MAJOR.MINOR.PATCH/filename.ext`
    const nonMatchingImages = Object.values(enclosingDirsMap).filter(d => !d)
    if (nonMatchingImages.length) {
      console.warn(
        'The following images are not located in "images/oldestReleases/{MAJOR.MINOR.PATCH}/", remove them manually',
        '\n',
        nonMatchingImages.join('\n')
      )
      return
    }

    const directoryDeleteConfirm =
      'This will delete the following directories' +
      '\n\t* ' +
      Object.keys(enclosingDirsMap).join('\n\t* ') +
      '\nProceed? (y/n)'

    const answer = await requiredQuestion(rl, directoryDeleteConfirm, input =>
      input === 'y' || input === 'n'
        ? {valid: true, message: ''}
        : {valid: false, message: 'Enter either (y/n)'}
    )

    if (answer === 'n') {
      return
    }

    const enclosingDirsPaths = Object.keys(enclosingDirsMap)
    const removeDirsPromiseChain = enclosingDirsPaths.reduce((prevChain, dirPath) => {
      return prevChain.then(() => {
        return new Promise((resolve, reject) => {
          rimraf(dirPath, {}, (err: Error) => {
            if (err) {
              return reject(dirPath)
            }
            resolve()
          })
        })
      })
    }, Promise.resolve())

    try {
      await removeDirsPromiseChain
    } catch (err) {
      console.warn(`(Error): Failed to remove directory ${err}`)
    }
  }
}

export default commands
