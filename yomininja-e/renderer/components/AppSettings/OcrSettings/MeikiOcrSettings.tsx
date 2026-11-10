import { Button, Container, FormControl, FormControlLabel, FormLabel, Link, Radio, RadioGroup, Typography, debounce } from "@mui/material";
import { useContext, useEffect, useState } from "react";
import { SettingsContext } from "../../../context/settings.provider";
import { MeikiOcrEngineSettings } from "../../../../electron-src/@core/infra/ocr/meiki_ocr.adapter/meiki_ocr_settings";
import { HardwareAccelerationOption } from "../../../../electron-src/@core/application/adapters/ocr.adapter";
import CommonOcrSettings from "./CommonOcrSettings";
import OcrSettingsSlider from "./OcrSettingsSlider";
import AlertDialog from "../../common/AlertDialog";


type MeikiOcrSettingsProps = {
    ocrEngineSettings: MeikiOcrEngineSettings;
};

export default function MeikiOcrSettings( props: MeikiOcrSettingsProps ) {

    const { ocrEngineSettings } = props;
    const {
        updateActivePresetOcrEngine,
        getHardwareAccelerationOptions,
        installHardwareAcceleration
    } = useContext( SettingsContext );

    const [ detThreshold, setDetThreshold ] = useState( ocrEngineSettings?.det_threshold ?? 0.5 );
    const [ recThreshold, setRecThreshold ] = useState( ocrEngineSettings?.rec_threshold ?? 0.1 );

    const [ HWOptions, setHWOptions ] = useState< HardwareAccelerationOption[] | undefined >( [] );
    const [ activeHWOption, setActiveHWOption ] = useState< string | undefined >( '' );
    const [ selectedHWOption, setSelectedHWOption ] = useState< string | undefined >( '' );
    const [ openDialog, setOpenDialog ] = useState< boolean >( false );

    useEffect( () => {
        if ( !ocrEngineSettings ) return;
        setDetThreshold( ocrEngineSettings.det_threshold ?? 0.5 );
        setRecThreshold( ocrEngineSettings.rec_threshold ?? 0.1 );
        refreshHWOptions();
    }, [ ocrEngineSettings ] );

    function handleEngineSettingsUpdate( update: Partial< MeikiOcrEngineSettings > ) {
        if ( !ocrEngineSettings ) return;
        updateActivePresetOcrEngine({
            ...ocrEngineSettings,
            ...update,
        });
    }

    const handleEngineSettingsUpdateDeb = debounce( handleEngineSettingsUpdate, 100 );

    function refreshHWOptions() {
        getHardwareAccelerationOptions( 'MeikiOcrAdapter' )
            .then( options => {
                setHWOptions( options );

                const activeOption = options.find( option => option.installed );

                if ( !activeOption )
                    return;

                const activeOptionID = getHWOptionID( activeOption );

                setActiveHWOption( activeOptionID );
                setSelectedHWOption( activeOptionID );
            });
    }

    function getHWOptionID( option: HardwareAccelerationOption ): string {
        return [
            option.backend,
            option.computePlatform,
            option.computePlatformVersion || ''
        ].join( '/' );
    }

    function handleHWSelection(
        _event: React.ChangeEvent< HTMLInputElement >,
        optionID: string
    ) {
        setSelectedHWOption( optionID );
    }

    function applyHWSelection() {
        if ( !selectedHWOption ) return;
        const [ backend, computePlatform, computePlatformVersion ] = selectedHWOption.split( '/' );
        const option = HWOptions?.find( option => (
            backend == option.backend &&
            computePlatform == option.computePlatform &&
            computePlatformVersion == option.computePlatformVersion
        ));

        if ( !option ) return;

        installHardwareAcceleration( 'MeikiOcrAdapter', option )
            .then( success => {
                if ( success )
                    refreshHWOptions();
            });
    }

    const meikiLink = (
        <Link href='https://github.com/rtr46/meikiocr' target='_blank' rel='noopener noreferrer'>
            MeikiOCR
        </Link>
    );

    return (
        <Container sx={{ mt: 2, mb: 2 }}>

            <AlertDialog
                title={'Are you sure you want to replace the current runtime?'}
                message="This operation might take a few minutes to complete."
                okButtonText="Yes"
                cancelButtonText="No"
                open={ openDialog }
                handleCancel={ () => {
                    setOpenDialog( false );
                }}
                handleOk={ applyHWSelection }
                handleClose={ () => setOpenDialog( false ) }
            />

            <Typography component="div" fontSize='1.0rem' mt={1} mb={2}>
                {meikiLink} is a local OCR engine trained for Japanese video game and visual novel text.
                It runs fully offline (models download once from Hugging Face). Vertical text support is weaker than horizontal.
            </Typography>

            <CommonOcrSettings ocrEngineSettings={ocrEngineSettings} />

            <Container
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    marginLeft: '20px',
                    marginTop: '40px'
                }}
            >
                <FormControl sx={{ mt: 1 }}>
                    <FormLabel id="meiki-hw-radio-buttons-group-label">Inference Runtime</FormLabel>
                    <RadioGroup
                        row
                        aria-labelledby="meiki-hw-radio-buttons-group-label"
                        name="meiki-row-radio-buttons-group"
                        value={ selectedHWOption }
                        onChange={ handleHWSelection }
                    >
                        { HWOptions?.map( option => {
                            const value = getHWOptionID( option );
                            const isActive = value === activeHWOption;
                            const shortLabel = ( option.computePlatform + ' ' + ( option.computePlatformVersion || '' ) ).trim();
                            const longLabel = [
                                option.backend,
                                option.computePlatform,
                                option.computePlatformVersion || ''
                            ].filter( Boolean ).join( ' ' );
                            const title = isActive ? longLabel + ' (Active)' : longLabel;
                            const outerRingColor = isActive ? '#40a3f3' : 'gray';
                            return (
                                <FormControlLabel
                                    key={ value }
                                    value={ value }
                                    title={ title }
                                    control={
                                        <Radio
                                            sx={{
                                                color: outerRingColor,
                                                '&.Mui-checked': {
                                                    color: '#40a3f3',
                                                },
                                            }}
                                        />
                                    }
                                    label={ shortLabel }
                                    sx={{ ml: 2, mr: 3 }}
                                />
                            );
                        })}

                        <Button
                            disabled={ activeHWOption == selectedHWOption }
                            variant="contained"
                            sx={{ ml: 3 }}
                            onClick={ () => setOpenDialog( true ) }
                        >
                            Apply
                        </Button>
                    </RadioGroup>
                </FormControl>
            </Container>

            <Container sx={{ mt: 3, mb: 2, ml: 0, pl: 0 }}>
                <OcrSettingsSlider
                    label="Detection threshold"
                    title="Higher values detect fewer, more confident text boxes"
                    leftLabel="More boxes"
                    rightLabel="Fewer boxes"
                    min={0.1}
                    max={0.9}
                    step={0.05}
                    value={ detThreshold }
                    onChange={ ( _event, newValue ) => {
                        if ( typeof newValue === 'number' ) {
                            setDetThreshold( newValue );
                        }
                    }}
                    onChangeCommitted={ () => {
                        handleEngineSettingsUpdateDeb({
                            det_threshold: detThreshold,
                        });
                    }}
                    reset={ () => {
                        setDetThreshold( 0.5 );
                        handleEngineSettingsUpdate({
                            det_threshold: 0.5,
                        });
                    }}
                />

                <OcrSettingsSlider
                    label="Recognition threshold"
                    title="Higher values keep fewer, more confident characters"
                    leftLabel="More chars"
                    rightLabel="Fewer chars"
                    min={0}
                    max={0.5}
                    step={0.05}
                    value={ recThreshold }
                    onChange={ ( _event, newValue ) => {
                        if ( typeof newValue === 'number' ) {
                            setRecThreshold( newValue );
                        }
                    }}
                    onChangeCommitted={ () => {
                        handleEngineSettingsUpdateDeb({
                            rec_threshold: recThreshold,
                        });
                    }}
                    reset={ () => {
                        setRecThreshold( 0.1 );
                        handleEngineSettingsUpdate({
                            rec_threshold: 0.1,
                        });
                    }}
                />
            </Container>
        </Container>
    );
}
