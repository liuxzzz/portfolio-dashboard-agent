import Dypnsapi20170525, {
  SendSmsVerifyCodeRequest,
} from "@alicloud/dypnsapi20170525";
import { $OpenApiUtil } from "@alicloud/openapi-core";
import { smsPhoneNumber, type SmsSender } from "./auth.js";

type DypnsapiClient = InstanceType<typeof Dypnsapi20170525>;
const DypnsapiClientConstructor = (
  Dypnsapi20170525 as unknown as { default: typeof Dypnsapi20170525 }
).default;

export interface AliyunSmsOptions {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  endpoint?: string;
}

export class AliyunSmsSender implements SmsSender {
  private readonly client: DypnsapiClient;

  constructor(private readonly options: AliyunSmsOptions) {
    this.client = new DypnsapiClientConstructor(
      new $OpenApiUtil.Config({
        accessKeyId: options.accessKeyId,
        accessKeySecret: options.accessKeySecret,
        endpoint: options.endpoint ?? "dypnsapi.aliyuncs.com",
      }),
    );
  }

  async sendVerificationCode(phone: string, code: string) {
    const response = await this.client.sendSmsVerifyCode(
      new SendSmsVerifyCodeRequest({
        phoneNumber: smsPhoneNumber(phone),
        countryCode: "86",
        signName: this.options.signName,
        templateCode: this.options.templateCode,
        templateParam: JSON.stringify({ code, min: "5" }),
        interval: 60,
        validTime: 300,
        returnVerifyCode: false,
      }),
    );
    if (response.body?.code !== "OK" || response.body.success === false) {
      throw new Error(
        `阿里云短信认证发送失败：${response.body?.code ?? "unknown"} (${response.body?.requestId ?? "no-request-id"})`,
      );
    }
  }
}
