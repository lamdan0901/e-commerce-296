"use client";

import { ResizeHandler } from "@/components";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { BASE_PRICE, COLORS, FINISHES, MATERIALS, MODELS } from "@/constants";
import { useUploadThing } from "@/lib/uploadthing";
import { cn, formatPrice } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { saveConfig as _saveConfig, SaveConfigArgs } from "./actions";
import { PhoneCaseStyler } from "./components/PhoneCaseStyler";
import { TPhoneCaseOption } from "./types";

interface DesignConfigProps {
  configId: string;
  imageUrl: string;
  imageDimensions: { width: number; height: number };
}

export const DesignConfig = ({
  configId,
  imageUrl,
  imageDimensions,
}: DesignConfigProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const { mutate: saveConfigs, isPending } = useMutation({
    mutationKey: ["save-config"],
    mutationFn: async (args: SaveConfigArgs) => {
      await Promise.all([saveDesignConfig(), _saveConfig(args)]);
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "There was an error on our end. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      router.push(`/configure/preview?id=${configId}`);
    },
  });

  const [options, setOptions] = useState<TPhoneCaseOption>({
    color: COLORS[0],
    model: MODELS.options[0],
    material: MATERIALS.options[0],
    finish: FINISHES.options[0],
  });

  const [renderedDimension, setRenderedDimension] = useState({
    width: imageDimensions.width / 4,
    height: imageDimensions.height / 4,
  });

  const [renderedPosition, setRenderedPosition] = useState({
    x: 150,
    y: 205,
  });

  const phoneCaseRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { startUpload } = useUploadThing("imageUploader");

  async function saveDesignConfig() {
    try {
      const {
        left: caseLeft,
        top: caseTop,
        width,
        height,
      } = phoneCaseRef.current!.getBoundingClientRect();

      const { left: containerLeft, top: containerTop } =
        containerRef.current!.getBoundingClientRect();

      const leftOffset = caseLeft - containerLeft;
      const topOffset = caseTop - containerTop;

      // These are the actual coordinates of design image relative to the the phone case.
      const actualX = renderedPosition.x - leftOffset;
      const actualY = renderedPosition.y - topOffset;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      // We create an image element, load it from the URL and draw it on the canvas.
      const userImage = new Image();
      userImage.crossOrigin = "anonymous";
      userImage.src = imageUrl;
      await new Promise((resolve) => (userImage.onload = resolve));

      ctx?.drawImage(
        userImage,
        actualX,
        actualY,
        renderedDimension.width,
        renderedDimension.height
      );

      const base64 = canvas.toDataURL();
      const base64Data = base64.split(",")[1];

      const blob = base64ToBlob(base64Data, "image/png");
      const file = new File([blob], "filename.png", { type: "image/png" });

      await startUpload([file], { configId });
    } catch (err) {
      toast({
        title: "Something went wrong",
        description:
          "There was a problem saving your config, please try again.",
        variant: "destructive",
      });
    }
  }

  function base64ToBlob(base64: string, mimeType: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  return (
    <div className="relative mt-20 grid grid-cols-1 lg:grid-cols-3 mb-20 pb-20">
      <div
        ref={containerRef}
        className="relative h-[37.5rem] overflow-hidden col-span-2 w-full max-w-4xl flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <div className="relative w-60 bg-opacity-50 pointer-events-none aspect-[896/1831]">
          {/* The frame of the phone case (camera and border) */}
          <AspectRatio
            ref={phoneCaseRef}
            ratio={896 / 1831}
            className="pointer-events-none relative z-50 aspect-[896/1831] w-full"
          >
            <NextImage
              fill
              alt="phone image"
              src="/phone-template.png"
              className="pointer-events-none z-50 select-none"
            />
          </AspectRatio>

          {/* An overlay around the phone case and above the overflow part of the design image. */}
          <div className="absolute z-40 inset-0 left-[3px] top-px right-[3px] bottom-px rounded-[32px] shadow-[0_0_0_99999px_rgba(229,231,235,0.6)]" />

          {/* Fill the phone case with user-selected color */}
          <div
            className={cn(
              "absolute inset-0 left-[3px] top-px right-[3px] bottom-px rounded-[32px]",
              `bg-${options.color.tw}`
            )}
          />
        </div>

        <Rnd
          default={{
            // initial x, y, width and height of the image
            ...renderedPosition,
            ...renderedDimension,
          }}
          onResizeStop={(_, __, el, ___, { x, y }) => {
            setRenderedDimension({
              // conversion from string with 'px' to number
              height: parseInt(el.style.height.slice(0, -2)),
              width: parseInt(el.style.width.slice(0, -2)),
            });
            setRenderedPosition({ x, y });
          }}
          onDragStop={(_, { x, y }) => {
            setRenderedPosition({ x, y });
          }}
          className="absolute z-[20] border-[3px] border-primary"
          lockAspectRatio
          resizeHandleComponent={{
            bottomRight: <ResizeHandler />,
            bottomLeft: <ResizeHandler />,
            topRight: <ResizeHandler />,
            topLeft: <ResizeHandler />,
          }}
        >
          <div className="relative size-full">
            <NextImage
              src={imageUrl}
              fill
              alt="your image"
              className="pointer-events-none"
            />
          </div>
        </Rnd>
      </div>

      <div className="h-[37.5rem] w-full col-span-full lg:col-span-1 flex flex-col bg-white">
        <PhoneCaseStyler options={options} setOptions={setOptions} />

        <div className="w-full px-8 h-16 bg-white">
          <div className="size-full flex border-t border-zinc-200 gap-6 items-center">
            <p className="font-medium whitespace-nowrap">
              {formatPrice(
                (BASE_PRICE + options.finish.price + options.material.price) /
                  100
              )}
            </p>
            <Button
              isLoading={isPending}
              disabled={isPending}
              loadingText="Saving"
              onClick={() =>
                saveConfigs({
                  configId,
                  color: options.color.value,
                  finish: options.finish.value,
                  material: options.material.value,
                  model: options.model.value,
                })
              }
              size="sm"
              className="w-full"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-1.5 inline" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
