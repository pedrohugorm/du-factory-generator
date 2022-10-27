import * as React from "react"
import { isCraftable, Item, ITEMS, Recipe, getRecipe, Category } from "../items"
import { values } from "ramda"
import { AppState } from "./app"
import { Button, Upload, Row, Col, Divider } from "antd"
import { FactorySelect } from "./factory-select"
import { FactoryCount } from "./factory-count"
import { FactoryGraph, PerSecond } from "../graph"
import { FactoryVisualization } from "./render-factory"
import { deserialize } from "../serialize"
import { FactoryInstruction } from "./generate-instructions"
import { SelectedCategories } from "../generator"

export enum FactoryState {
    UPLOAD = "upload",
    SELECT = "select",
    COUNT = "count",
    RENDER = "render",
    ERROR = "error",
}

/**
 * Properties of the Factory component
 */
interface FactoryProps {
    /**
     * Set the parent application state
     * @param state the AppState
     */
    setAppState: (state: AppState) => void

    // User's talent levels
    talentLevels: { [key: string]: number }

    // Prices of ores
    orePrices: { [key: string]: number }

    // Starting factory state
    startFactoryState: FactoryState

    selectedCategories: SelectedCategories;
}

/**
 * Factory component
 * @param props {@link FactoryProps}
 */
export function Factory(props: FactoryProps) {
    // all possible craftable items
    const items = React.useMemo(() => values(ITEMS).filter(isCraftable), [ITEMS])
    // current and previous factory state
    const [factoryState, setFactoryState] = React.useState<FactoryState>(props.startFactoryState)
    const [selectedCategories, setSelectedCategories] = React.useState<SelectedCategories>(props.selectedCategories)
    // error message
    const [errorMessage, setErrorMessage] = React.useState<string>()
    //  factory building instructions instructions
    const [factoryInstructions, setFactoryInstructions] = React.useState<FactoryInstruction[]>([])
    // produced items, industry count, and maintain count
    const [selection, setSelection] = React.useState<Item[]>([])
    const [productionRate, setProductionRate] = React.useState<{ [key: string]: PerSecond }>({})
    const [maintainValue, setMaintainValue] = React.useState<{ [key: string]: number }>({})
    // the recipes for all produced items
    const recipes = React.useMemo(
        () =>
            new Map<Item, Recipe>(
                selection.map((item) => [item, getRecipe(item, props.talentLevels)]),
            ),
        [selection],
    )
    // the FactoryGraph and a flag to show differences
    const [showDifferences, setShowDifferences] = React.useState<boolean>(false)
    const [startingFactory, setStartingFactory] = React.useState<FactoryGraph>()
    const [factory, setFactory] = React.useState<FactoryGraph>()
    // parse the production rate and maintain values, generate requirements
    const getProductionRate = (item: Item) =>
        productionRate[item.name] || recipes.get(item)!.quantity / recipes.get(item)!.time
    const getMaintainValue = (item: Item) =>
        maintainValue[item.name] || Math.ceil(getProductionRate(item) * 24 * 3600)
    const getRequirements = () =>
        new Map<Item, { rate: PerSecond; maintain: number }>(
            selection.map((item) => [
                item,
                { rate: getProductionRate(item), maintain: getMaintainValue(item) },
            ]),
        )
    const getSelectedCategories = () => selectedCategories;

    switch (factoryState) {
        default:
            return (
                <React.Fragment>
                    <Button onClick={() => props.setAppState(AppState.HOME)}>Back</Button>
                    <ExistingFactorySummary factory={startingFactory} />
                    <FactorySelect
                        setFactoryState={setFactoryState}
                        items={items}
                        selection={selection}
                        setSelection={setSelection}
                        setProductionRate={setProductionRate}
                        setMaintainValue={setMaintainValue}
                    />
                </React.Fragment>
            )
        case FactoryState.UPLOAD:
            return (
                <React.Fragment>
                    <Button onClick={() => props.setAppState(AppState.HOME)}>Back</Button>
                    <h2>Start from an Existing Factory</h2>
                    <Divider orientation="left">Instructions</Divider>
                    <ul>
                        <li>Upload a JSON file previously generated by this tool.</li>
                    </ul>
                    <Divider orientation="left">Upload</Divider>
                    <Upload
                        accept=".json"
                        showUploadList={false}
                        beforeUpload={(file) => {
                            const reader = new FileReader()
                            reader.onload = () => {
                                const factoryJSON = reader.result as string
                                let uploadedFactory: FactoryGraph | undefined = undefined
                                try {
                                    uploadedFactory = deserialize(factoryJSON, props.talentLevels)
                                } catch (e) {
                                    setFactoryState(FactoryState.ERROR)
                                    setErrorMessage(e.message)
                                    return
                                }
                                setStartingFactory(uploadedFactory)
                                // create another copy to be modified
                                const uploadedFactoryCopy = deserialize(
                                    factoryJSON,
                                    props.talentLevels,
                                )
                                setFactory(uploadedFactoryCopy)
                                setShowDifferences(true)
                                setStartingFactory(uploadedFactory)
                                setFactoryState(FactoryState.SELECT)
                            }
                            reader.readAsText(file)
                            // skip upload
                            return false
                        }}
                    >
                        <Button type="primary">Upload Factory JSON</Button>
                    </Upload>
                </React.Fragment>
            )
        case FactoryState.COUNT:
            return (
                <React.Fragment>
                    <Button onClick={() => setFactoryState(FactoryState.SELECT)}>Back</Button>
                    <ExistingFactorySummary factory={startingFactory} />
                    <FactoryCount
                        selection={selection}
                        getSelectedCategories={getSelectedCategories}
                        setSelectedCategories={setSelectedCategories}
                        recipes={recipes}
                        setFactoryState={setFactoryState}
                        setErrorMessage={setErrorMessage}
                        setProductionRate={setProductionRate}
                        getProductionRate={getProductionRate}
                        setMaintainValue={setMaintainValue}
                        getMaintainValue={getMaintainValue}
                        getRequirements={getRequirements}
                        talentLevels={props.talentLevels}
                        factory={factory}
                        setFactory={setFactory}
                        setFactoryInstructions={setFactoryInstructions}
                        showDifferences={showDifferences}
                    />
                </React.Fragment>
            )
        case FactoryState.RENDER:
            return (
                <FactoryVisualization
                    selectedCategories={getSelectedCategories()}
                    factory={factory}
                    setFactory={setFactory}
                    startingFactory={startingFactory}
                    setFactoryState={setFactoryState}
                    instructions={factoryInstructions!}
                    selection={selection}
                    orePrices={props.orePrices}
                />
            )
        case FactoryState.ERROR:
            return (
                <React.Fragment>
                    <Button onClick={() => props.setAppState(AppState.HOME)}>Back</Button>
                    <h2>
                        <div id="error">Factory Error</div>
                    </h2>
                    {errorMessage} <br />
                    <div id="error">
                        If this error is unexpected, then please report this to the developers via
                        Discord or the "Report an Issue" link below! Please include all necessary
                        information that can be used to reproduce this error (e.g., what you were
                        trying to produce, factory JSON file if you started from a previous factory,
                        etc.).
                    </div>
                </React.Fragment>
            )
    }
}

/**
 * Properties of the ExistingFactorySummary component
 */
interface ExistingFactorySummaryProps {
    // the factory graph
    factory: FactoryGraph | undefined
}

/**
 * ExistingFactoryFactory component
 * @param props {@link ExistingFactorySummaryProps}
 */
export function ExistingFactorySummary({ factory }: ExistingFactorySummaryProps) {
    if (factory === undefined) {
        return <React.Fragment></React.Fragment>
    }

    const elements = []
    for (const output of factory.containers) {
        if (output.outputRate > 0) {
            let productionRate = output.outputRate
            let unit = "second"
            if (productionRate < 1.0) {
                productionRate *= 60.0
                unit = "minute"
            }
            if (productionRate < 1.0) {
                productionRate *= 60.0
                unit = "hour"
            }
            if (productionRate < 1.0) {
                productionRate *= 24.0
                unit = "day"
            }
            // round to 2 decimals
            productionRate = Math.round(productionRate * 100) / 100
            const element = (
                <Row key={output.name}>
                    <Col span={3}>{output.item.name}</Col>
                    <Col span={3}>{productionRate + " / " + unit}</Col>
                    <Col span={3}>{Math.round(output.maintainedOutput)}</Col>
                </Row>
            )
            elements.push(element)
        }
    }

    if (elements.length > 0) {
        return (
            <React.Fragment>
                <h2>Existing Factory Production</h2>
                <Row className="tableHeader">
                    <Col span={3}>Item</Col>
                    <Col span={3}>Production Rate</Col>
                    <Col span={3}>Maintain</Col>
                </Row>
                {elements}
            </React.Fragment>
        )
    }
    return <React.Fragment></React.Fragment>
}
