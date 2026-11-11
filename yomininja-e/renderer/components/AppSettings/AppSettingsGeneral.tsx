import { Box, Container, Divider, FormControl, FormControlLabel, FormGroup, InputLabel, MenuItem, Select, Switch, Typography } from "@mui/material";
import { SettingsContext } from "../../context/settings.provider";
import { useContext, useEffect, useState } from "react";
import { SettingsPresetJson } from "../../../electron-src/@core/domain/settings_preset/settings_preset";
import { GeneralSettings, RunAtSystemStartupOptions } from "../../../electron-src/@core/domain/settings_preset/settings_preset_general";
import { CaptureBackend, CompatibilitySettings } from "../../../electron-src/@core/domain/settings_preset/settings_preset_compatibility";


// Settings section component
export default function AppSettingsGeneral() {

    const {
        activeSettingsPreset,
        defaultSettingsPreset,
        updateActivePresetGeneral,
        updateActivePresetCompatibility
    } = useContext( SettingsContext );

    const generalSettings: GeneralSettings = activeSettingsPreset?.general;
    const compatibilitySettings: CompatibilitySettings = activeSettingsPreset?.compatibility;

    console.log({
        generalSettings,
        compatibilitySettings
    });
    
    return (
        <Box sx={{ flexGrow: 1, margin: 1, mt:0 }}>

            <Typography gutterBottom variant="h6" component="div" ml={0} mb={3}>
                General
            </Typography>

            <Container sx={{ ml: 1.5,  mt: 2, mb: 2 }}>
                <FormControl fullWidth 
                    sx={{
                        display:'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        width: 300
                    }}>
                    
                    <Select
                        value={ generalSettings?.run_at_system_startup || 'no' }
                        label="Run at System Startup"
                        title=""
                        onChange={ ( event ) => {
                            const { value } = event.target;
                            if (typeof value === 'string') {
                                console.log(value)
                                updateActivePresetGeneral({
                                    run_at_system_startup: value as RunAtSystemStartupOptions
                                });
                            }
                        }}
                        sx={{ minWidth: !generalSettings?.run_at_system_startup ? 220 : 150 }}
                    >
                        <MenuItem value='minimized'>
                            Minimized
                        </MenuItem>
                        <MenuItem value='yes'>
                            Yes
                        </MenuItem>
                        <MenuItem value='no'>
                            No
                        </MenuItem>
                    </Select>

                    <InputLabel>Run at System Startup</InputLabel>

                </FormControl>
                
            </Container>

            <Container sx={{ ml: 1.5,  mt: 0, mb: 2 }}>
                <FormControlLabel label='Enable Hardware Acceleration'
                    title='Changes will take effect after restarting the app.'
                    control={
                        <Switch
                            checked={
                                typeof compatibilitySettings?.hardware_acceleration === 'undefined' ?
                                    true :
                                    Boolean( compatibilitySettings?.hardware_acceleration )
                            }
                            onChange={ ( event ) => {
                                updateActivePresetCompatibility({
                                    hardware_acceleration: event.target.checked
                                });
                            }}
                        /> 
                    }
                />
            </Container>


            <Container sx={{ ml: 1.5,  mt: 0, mb: 2 }}>
                <FormControlLabel label='Enable GPU Compositing'
                    title='Changes will take effect after restarting the app.'
                    control={
                        <Switch
                            checked={
                                typeof compatibilitySettings?.gpu_compositing === 'undefined' ?
                                    true :
                                    Boolean( compatibilitySettings?.gpu_compositing )
                            }
                            onChange={ ( event ) => {
                                updateActivePresetCompatibility({
                                    gpu_compositing: event.target.checked
                                });
                            }}
                        /> 
                    }
                />
            </Container>

            { typeof navigator !== 'undefined' && navigator.userAgent.includes( 'Windows' ) && (
                <>
                    <Typography gutterBottom variant="h6" component="div" ml={0} mb={2} mt={3}>
                        Capture (Windows)
                    </Typography>

                    <Container sx={{ ml: 1.5, mt: 0, mb: 2 }}>
                        <FormControl fullWidth
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                width: 360
                            }}
                        >
                            <Select
                                value={ compatibilitySettings?.capture_backend || 'auto' }
                                label="OCR Capture Backend"
                                title="Auto prefers Windows.Graphics.Capture, then falls back."
                                onChange={ ( event ) => {
                                    const { value } = event.target;
                                    if ( typeof value === 'string' ) {
                                        updateActivePresetCompatibility({
                                            capture_backend: value as CaptureBackend
                                        });
                                    }
                                }}
                                sx={{ minWidth: 220 }}
                            >
                                <MenuItem value="auto">Auto (recommended)</MenuItem>
                                <MenuItem value="wgc">Windows.Graphics.Capture</MenuItem>
                                <MenuItem value="webrtc">WebRTC</MenuItem>
                                <MenuItem value="desktop_capturer">desktopCapturer</MenuItem>
                            </Select>
                            <InputLabel>OCR Capture Backend</InputLabel>
                        </FormControl>
                    </Container>

                    <Container sx={{ ml: 1.5, mt: 0, mb: 2 }}>
                        <FormControlLabel
                            label="Show yellow capture border"
                            title="Windows privacy border around the captured window/display (WGC only)."
                            control={
                                <Switch
                                    checked={ Boolean( compatibilitySettings?.show_wgc_border ) }
                                    onChange={ ( event ) => {
                                        updateActivePresetCompatibility({
                                            show_wgc_border: event.target.checked
                                        });
                                    }}
                                />
                            }
                        />
                    </Container>
                </>
            )}

        </Box>
    )
}