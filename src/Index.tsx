import { desktopCapturer, DesktopCapturerSource, globalShortcut } from 'electron';
import * as React from 'react';
import { findDOMNode } from 'react-dom';
import { writeFile } from 'fs';
import { resolve } from 'path';
import * as mkdirp from 'mkdirp';
import * as dateformat from 'dateformat';

import { Button, Intent, FormGroup, NumericInput, Switch } from '@blueprintjs/core';
import { ChangeEvent, SyntheticEvent } from 'react';

import toaster from './toaster';

export default class Main extends React.Component<{}, {
    captureSources: DesktopCapturerSource[],
    captureSourceId: string,
    streamUrl: string,
    captureSourceWidth: number,
    captureSourceHeight: number,
    offsetX: number,
    offsetY: number,
    captureWidth: number,
    captureHeight: number,
    diffThreshold: number,
    diffThresholdCount: number,
    diffThreshold2: number,
    autoCapture: boolean,
    path: string
}> {
    private imageCanvas: HTMLCanvasElement;
    private stream: MediaStream | null = null;
    private previewTimer: number = 0;
    private diffCount: number = 0;
    private previousImage: Uint8ClampedArray | null = null;
    constructor(props) {
        super(props);
        this.imageCanvas = document.createElement('canvas');
        this.state = {
            captureSources: [],
            captureSourceId: '',
            captureSourceHeight: 0,
            captureSourceWidth: 0,
            streamUrl: '',
            offsetX: 0,
            offsetY: 0,
            captureWidth: 1,
            captureHeight: 1,
            diffThreshold: 0,
            diffThresholdCount: 3,
            diffThreshold2: 0.5,
            autoCapture: false,
            path: './captures'
        };
    }

    componentDidMount() {
        this.updateCaptureSource();
    }

    updateCaptureSource() {
        desktopCapturer.getSources({ types: ['window'] }, (err, sources) => {
            if (err) {
                toaster.show({ message: err.message, intent: Intent.DANGER });
                return;
            }
            console.log(sources);
            this.setState({ captureSources: sources, captureSourceId: sources[0].id });
        });
    }

    startCapture() {
        if (this.stream) {
            this.stream.getVideoTracks()[0].stop();
            this.stream = null;
            this.setState({
                streamUrl: '',
                captureSourceHeight: 0,
                captureSourceWidth: 0,
                autoCapture: false
            });
            this.updatePreview();
            clearInterval(this.previewTimer);
            toaster.show({ message: `Capture stopped`, intent: Intent.WARNING });
        } else {
            navigator.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: this.state.captureSourceId,
                        minWidth: 1280,
                        minHeight: 720,
                        maxHeight: 1080,
                        maxWidth: 1920
                    }
                }
            } as any, stream => {
                this.setState({
                    streamUrl: URL.createObjectURL(stream)
                });
                this.stream = stream;
                toaster.show({ message: `Capture started`, intent: Intent.SUCCESS });
            }, error => {
                toaster.show({ message: `Error: ${error.message}`, intent: Intent.DANGER });
            });
        }
    }

    updateMeta(e: ChangeEvent<HTMLVideoElement>) {
        const video = e.target;
        toaster.show({ message: `Res: ${video.videoWidth}x${video.videoHeight}`, intent: Intent.PRIMARY });
        this.setState({
            captureSourceHeight: video.videoHeight,
            captureSourceWidth: video.videoWidth,
            offsetX: 0,
            offsetY: 0,
            captureHeight: video.videoHeight,
            captureWidth: video.videoWidth
        });
        this.imageCanvas.width = video.videoWidth;
        this.imageCanvas.height = video.videoHeight;
        video.play();
        this.previewTimer = setInterval(() => this.updatePreview(), 250) as any;
        this.updatePreview();
    }

    updatePreview() {
        const video = findDOMNode(this.refs.videoPreview) as HTMLVideoElement;
        const previewCanvas = findDOMNode(this.refs.previewCanvas) as HTMLCanvasElement;
        const context = previewCanvas.getContext('2d');
        let imageW = Math.min((360 - 10) * this.state.captureWidth / this.state.captureHeight, 640 - 10);
        let imageH = Math.min((640 - 10) * this.state.captureHeight / this.state.captureWidth, 360 - 10);
        if (imageW === 640 - 10)
            imageW = imageH * this.state.captureWidth / this.state.captureHeight;
        if (imageH === 360 - 10)
            imageH = imageW * this.state.captureHeight / this.state.captureWidth;
        if (!context) {
            toaster.show({ message: `Error: context == null`, intent: Intent.DANGER });
            return;
        }
        if (this.imageCanvas.width !== this.state.captureWidth)
            this.imageCanvas.width = this.state.captureWidth;
        if (this.imageCanvas.height !== this.state.captureHeight)
            this.imageCanvas.height = this.state.captureHeight;
        context.clearRect(0, 0, this.state.captureWidth, this.state.captureHeight);
        context.drawImage(video, this.state.offsetX, this.state.offsetY, this.state.captureWidth, this.state.captureHeight, 5, 5, imageW, imageH);
        if (this.state.autoCapture)
            this.autoCapture(video);
    }

    autoCapture(video: HTMLVideoElement) {
        // pull previous image
        const context = this.imageCanvas.getContext('2d');
        if (!context) return;
        const prevImg = context.getImageData(0, 0, this.state.captureWidth, this.state.captureHeight);
        context.drawImage(video, this.state.offsetX, this.state.offsetY, this.state.captureWidth, this.state.captureHeight, 0, 0, this.state.captureWidth, this.state.captureHeight);
        const currImg = context.getImageData(0, 0, this.state.captureWidth, this.state.captureHeight);
        let diff = 0;
        for (let i = 0; i < prevImg.width * prevImg.height; i++) {
            if (Math.abs(currImg.data[i * 4] - prevImg.data[i * 4]) > 5 ||
                Math.abs(currImg.data[i * 4 + 1] - prevImg.data[i * 4 + 1]) > 5 ||
                Math.abs(currImg.data[i * 4 + 2] - prevImg.data[i * 4 + 2]) > 5) diff++;
        }
        const diffRate = diff / prevImg.width / prevImg.height * 100;
        // console.log('diffRate', diffRate);
        if (diffRate <= this.state.diffThreshold) {
            this.diffCount++;
        } else {
            this.diffCount = 0;
        }
        if (this.diffCount >= this.state.diffThresholdCount) {
            if (this.previousImage) {
                diff = 0;
                for (let i = 0; i < prevImg.width * prevImg.height; i++) {
                    if (Math.abs(currImg.data[i * 4] - this.previousImage[i * 4]) > 5 ||
                        Math.abs(currImg.data[i * 4 + 1] - this.previousImage[i * 4 + 1]) > 5 ||
                        Math.abs(currImg.data[i * 4 + 2] - this.previousImage[i * 4 + 2]) > 5) diff++;
                }
                const diffRate2 = diff / prevImg.width / prevImg.height * 100;
                console.log('diffRate2', diffRate2);
                if (this.state.diffThreshold2 <= diffRate2) {
                    this.capture();
                    this.previousImage = currImg.data;
                }
            } else {
                this.previousImage = currImg.data;
            }
        }
    }

    capture(doCapture: boolean = false) {
        if (doCapture) {
            const video = findDOMNode(this.refs.videoPreview) as HTMLVideoElement;
            const context = this.imageCanvas.getContext('2d');
            if (!context) return;
            context.drawImage(video, this.state.offsetX, this.state.offsetY, this.state.captureWidth, this.state.captureHeight, 0, 0, this.state.captureWidth, this.state.captureHeight);
        }
        this.imageCanvas.toBlob(blob => {
            if (!blob) {
                console.error('blob != null');
                toaster.show({ message: `Error!`, intent: Intent.DANGER });
                return;
            }
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                const buf = new Buffer(reader.result);
                const fname = `${dateformat('yyyy-mm-dd-HH-MM-ss')}.jpg`;
                const dir = resolve(this.state.path);
                const fpath = resolve(`${dir}/${fname}`);
                mkdirp.sync(dir);
                writeFile(fpath, buf, () => {
                    toaster.show({ message: `Captured as ${fname}!!`, intent: Intent.PRIMARY });
                    console.info('Saved!');
                });
            });
            reader.readAsArrayBuffer(blob);
        }, 'image/jpeg');
    }

    render() {
        return (
            <div>
                <FormGroup label='プレビュー' className='preview'>
                    <div className='preview-canvas'>
                        <video
                            width='360'
                            height='210'
                            controls
                            ref='videoPreview'
                            src={this.state.streamUrl}
                            onLoadedMetadata={(e: any) => this.updateMeta(e)} />
                        <Button text='今すぐキャプチャ'
                            iconName='camera'
                            disabled={!this.state.captureSourceHeight}
                            className='pt-large'
                            intent={Intent.DANGER}
                            onClick={() => this.capture(true)} />
                    </div>
                    <div className='preview-canvas'>
                        <canvas width='640' height='360' ref='previewCanvas' />
                        <span>Aspect Ratio: {this.state.captureWidth / this.state.captureHeight}:1 (16:9 = 1.77:1)</span>
                    </div>
                </FormGroup>
                <FormGroup label='入力' inline={true}>
                    <div className='pt-control-group'>
                        <div className='pt-select'>
                            <select className='select-ellipsis'
                                value={this.state.captureSourceId}
                                disabled={!!this.state.captureSourceHeight}
                                onChangeCapture={(e: ChangeEvent<HTMLSelectElement>) => this.setState({ captureSourceId: e.target.value })}>
                                {this.state.captureSources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
                            </select>
                        </div>
                        <Button iconName='refresh'
                            onClick={e => this.updateCaptureSource()}
                            disabled={!!this.state.captureSourceHeight} />
                        <Button iconName={!this.state.captureSourceHeight ? 'play' : 'stop'}
                            text={!this.state.captureSourceHeight ? '開始' : '停止'}
                            onClick={e => this.startCapture()}
                            intent={!this.state.captureSourceHeight ? Intent.PRIMARY : Intent.DANGER} />
                    </div>
                </FormGroup>
                <FormGroup label='X軸オフセット' inline={true}>
                    <NumericInput placeholder='Offset X'
                        min={0}
                        max={Math.max(1, this.state.captureSourceWidth - 10)}
                        value={this.state.offsetX}
                        disabled={!this.state.captureSourceHeight}
                        onValueChange={e => { this.setState({ offsetX: e }); this.updatePreview(); }} />
                </FormGroup>
                <FormGroup label='Y軸オフセット' inline={true}>
                    <NumericInput placeholder='Offset Y'
                        min={0}
                        max={Math.max(1, this.state.captureSourceHeight - 10)}
                        value={this.state.offsetY}
                        disabled={!this.state.captureSourceHeight}
                        onValueChange={e => { this.setState({ offsetY: e }); this.updatePreview(); }} />
                </FormGroup>
                <FormGroup label='キャプチャ縦幅' inline={true} >
                    <NumericInput placeholder='Capture width'
                        min={1}
                        max={Math.max(2, this.state.captureSourceWidth - this.state.offsetX)}
                        value={this.state.captureWidth}
                        disabled={!this.state.captureSourceHeight}
                        width={10}
                        onValueChange={e => { this.setState({ captureWidth: e }); this.updatePreview(); }} />
                </FormGroup>
                <FormGroup label='キャプチャ横幅' inline={true} >
                    <NumericInput placeholder='Capture height'
                        min={1}
                        max={Math.max(2, this.state.captureSourceHeight - this.state.offsetY)}
                        value={this.state.captureHeight}
                        disabled={!this.state.captureSourceHeight}
                        onValueChange={e => { this.setState({ captureHeight: e }); this.updatePreview(); }} />
                </FormGroup>
                <FormGroup label='保存先' inline={true}>
                    <input className='pt-input'
                        onChange={(e: ChangeEvent<HTMLInputElement>) => this.setState({ path: e.target.value })}
                        value={this.state.path} />
                </FormGroup>
                <Switch checked={this.state.autoCapture}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        this.setState({ autoCapture: e.target.checked });
                        if (e.target.checked)
                            toaster.show({ message: 'Auto capture started', intent: Intent.PRIMARY });
                        else
                            toaster.show({ message: 'Auto capture stopped', intent: Intent.WARNING });
                    }}
                    disabled={!this.state.captureSourceHeight}
                    label='自動キャプ切り替え' />
                <FormGroup label='画像の差の閾値' helperText='画像の変化がこれ以下になった時キャプチャします' inline={true}>
                    <NumericInput placeholder='Difference threshold'
                        min={0.1}
                        max={50}
                        stepSize={0.1}
                        value={this.state.diffThreshold}
                        disabled={this.state.autoCapture}
                        onValueChange={e => this.setState({ diffThreshold: e })} />
                </FormGroup>
                <FormGroup label='画像の変化の繰り返し' helperText='この回数変化した時キャプチャします' inline={true}>
                    <NumericInput placeholder='Difference threshold count'
                        min={1}
                        max={50}
                        value={this.state.diffThresholdCount}
                        disabled={this.state.autoCapture}
                        onValueChange={e => this.setState({ diffThresholdCount: e })} />
                </FormGroup>
                <FormGroup label='キャプチャ抑止の閾値' helperText='前回のキャプチャからの差分がこれ以下ならキャプチャしません' inline={true}>
                    <NumericInput placeholder='Difference threshold'
                        min={0}
                        max={100}
                        stepSize={0.1}
                        value={this.state.diffThreshold2}
                        disabled={this.state.autoCapture}
                        onValueChange={e => this.setState({ diffThreshold2: e })} />
                </FormGroup>
            </div>
        );
    }
}